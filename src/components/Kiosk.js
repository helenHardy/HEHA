import { store } from '../store.js';
import { supabase } from '../services/supabase.js';
import { generateReceiptHTML, printTicket } from '../utils/printer.js';

// Estado interno del Kiosco
// Restore active order from localStorage if exists
const savedOrder = JSON.parse(localStorage.getItem('heha_active_order') || 'null');

let kioskState = {
    screen: savedOrder ? 'success' : 'menu',
    diningOption: 'eat-in',
    isReservation: false,
    reservationTime: '',
    lastOrderId: savedOrder?.orderId || null,
    activeCategory: 'Todos',
    modalProduct: null,
    isChatOpen: false,
    messages: [],
    orderStatus: savedOrder?.status || 'pending',
    kitchenStatus: savedOrder?.kitchenStatus || 'pending'
};

// Helper: persist active order to localStorage
function saveActiveOrder() {
    if (kioskState.lastOrderId) {
        localStorage.setItem('heha_active_order', JSON.stringify({
            orderId: kioskState.lastOrderId,
            status: kioskState.orderStatus,
            kitchenStatus: kioskState.kitchenStatus
        }));
    }
}
function clearActiveOrder() {
    localStorage.removeItem('heha_active_order');
}

// Cache for Kiosk Data
let kioskCache = {
    products: null,
    categories: null
};

// Track previous state to avoid full re-renders
let lastRenderedScreen = null;

/**
 * Main render function for the Kiosk
 */
export async function renderKiosk(container, forceRefresh = false) {
    // If we are just opening/closing modal on 'menu' screen, DO NOT re-render base
    if (!forceRefresh && lastRenderedScreen === kioskState.screen && kioskState.screen === 'menu') {
        manageModalOverlay(container);
        return;
    }

    lastRenderedScreen = kioskState.screen;
    container.innerHTML = '';
    container.className = 'w-full h-screen bg-[#f4f4f4] overflow-hidden font-sans relative';

    // Central Re-render Helper
    window.renderKioskInstance = () => renderKiosk(container, true);

    switch (kioskState.screen) {
        case 'menu':
            await renderMenuScreen(container);
            break;
        case 'cart':
            renderCartScreen(container);
            break;
        case 'success':
            renderSuccessScreen(container);
            break;
    }

    // Initial check for modal if we just navigated to menu
    if (kioskState.screen === 'menu') {
        manageModalOverlay(container);
    }

    // Chat Bubble (Always accessible)
    const chatHtml = renderKioskChat();
    const chatContainer = document.createElement('div');
    chatContainer.id = 'kiosk-chat-wrapper';
    chatContainer.innerHTML = chatHtml;
    container.appendChild(chatContainer);

    // Toast Container
    if (!document.getElementById('kiosk-toast-container')) {
        const toastC = document.createElement('div');
        toastC.id = 'kiosk-toast-container';
        toastC.className = 'absolute top-24 right-8 z-50 flex flex-col gap-2 pointer-events-none';
        container.appendChild(toastC);
    }

    setupKioskChatRealtime(container);
    setupOrderStatusRealtime(container);
    setupKioskProductsRealtime(container);
}

/**
 * Manage Product Modal Overlay
 */
function manageModalOverlay(container) {
    const existingModal = document.getElementById('kiosk-modal-overlay');

    if (kioskState.modalProduct) {
        if (!existingModal) {
            renderProductModal(container);
        }
    } else {
        if (existingModal) {
            existingModal.remove();
        }
    }
}

/**
 * Render Menu Screen
 */
async function renderMenuScreen(container) {
    // 1. Load Data (Cached)
    if (!kioskCache.products || !kioskCache.categories) {
        const [prodRes, catRes] = await Promise.all([
            supabase.from('products').select('*'),
            supabase.from('categories').select('*').order('name')
        ]);
        kioskCache.products = prodRes.data;
        kioskCache.categories = catRes.data;
    }

    const products = kioskCache.products || [];
    const dbCategories = kioskCache.categories && kioskCache.categories.length > 0
        ? kioskCache.categories.map(c => c.name)
        : ['General'];

    const allCategories = ['Todos', ...dbCategories];
    const cartQty = store.cart.reduce((acc, item) => acc + item.quantity, 0);

    const filteredProducts = kioskState.activeCategory === 'Todos'
        ? products
        : products.filter(p => (p.category || 'General') === kioskState.activeCategory);

    container.innerHTML = `
    <div class="h-full flex bg-[#f8f8f8] select-none" style="font-family: 'Outfit', sans-serif;">
        <!-- Sidebar Navigation (Left) -->
        <aside class="w-20 md:w-32 lg:w-40 flex-shrink-0 bg-white shadow-[10px_0_30px_rgba(0,0,0,0.03)] z-20 flex flex-col items-center py-6 md:py-8 overflow-y-auto hide-scrollbar border-r border-gray-100">
            <div class="mb-8 md:mb-12" onclick="setKioskScreen('welcome')">
                 <img src="/logo.png" 
                      class="w-12 h-12 md:w-24 md:h-24 object-contain filter drop-shadow-sm hover:scale-110 transition cursor-pointer" 
                      onerror="this.src='https://placehold.co/150x150?text=HEHA'">
            </div>
            
            <nav class="flex-1 flex flex-col gap-4 md:gap-6 w-full px-2">
                ${allCategories.map(cat => `
                    <button onclick="kioskSetCategory('${cat}')" 
                           class="flex flex-col items-center p-3 rounded-[1.5rem] transition-all duration-300 group
                           ${kioskState.activeCategory === cat ? 'bg-primary text-white shadow-[0_10px_20_rgba(255,68,0,0.2)] scale-105' : 'text-gray-400 hover:text-gray-800 hover:bg-gray-50'}">
                        <div class="text-3xl md:text-4xl mb-1.5 transition-transform duration-300 group-hover:scale-110 ${kioskState.activeCategory === cat ? 'filter brightness-150 drop-shadow-sm' : 'filter grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100'}">
                            ${getCatIcon(cat)}
                        </div>
                        <span class="text-[9px] md:text-xs font-black uppercase tracking-tighter text-center leading-none">${cat}</span>
                    </button>
                `).join('')}
                
                <!-- Sidebar Bottom Actions -->
                <div class="mt-auto pt-4 pb-2 w-full flex flex-col gap-2 items-center">
                    ${cartQty > 0 ? `
                        <button onclick="setKioskScreen('cart')" class="w-full bg-primary text-white p-2.5 rounded-2xl shadow-lg shadow-primary/20 flex flex-col items-center gap-0.5 transition active:scale-95 relative">
                            <div class="absolute -top-1.5 -right-0.5 bg-white text-primary w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[10px] border-2 border-primary shadow-sm">
                                ${cartQty}
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"/></svg>
                            <span class="text-[8px] font-bold leading-none">Bs.${store.cartTotal.toFixed(0)}</span>
                        </button>
                    ` : ''}
                    <button onclick="toggleKioskChat()" class="w-full bg-gray-900 text-white p-2.5 rounded-2xl flex flex-col items-center gap-0.5 transition active:scale-95 relative shadow-sm">
                        <span class="absolute -top-1 -right-0.5 w-3 h-3 bg-primary rounded-full ${kioskState.messages.length > 0 ? '' : 'hidden'}"></span>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                        <span class="text-[8px] font-bold leading-none">Chat</span>
                    </button>
                </div>
            </nav>
        </aside>

        <!-- Main Content (Right) -->
        <main class="flex-1 flex flex-col h-full relative overflow-hidden">
            <!-- Header -->
            <header class="flex-shrink-0 px-5 md:px-10 py-5 md:py-8 flex justify-between items-center bg-white/70 backdrop-blur-md z-10 sticky top-0 border-b border-gray-100">
                <div class="flex-1 min-w-0 pr-4">
                   <h1 class="text-2xl md:text-5xl font-black text-gray-900 tracking-tight uppercase leading-none">${kioskState.activeCategory}</h1>
                   <p class="text-gray-400 font-bold mt-1 text-[10px] md:text-lg uppercase tracking-widest opacity-70">Explora nuestro menú</p>
                </div>
                
                <div class="flex items-center gap-4">
                    ${store.user ? `
                        <div class="flex items-center gap-2.5 bg-gray-50 p-1.5 pr-4 rounded-full border border-gray-100 shadow-sm transition transform active:scale-95 cursor-pointer group/user relative" onclick="toggleKioskUserMenu()">
                            <img src="${store.user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(store.user.full_name || 'U')}&background=FF4500&color=fff`}" 
                                 class="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-white object-cover shadow-sm"
                                 onerror="this.src='https://ui-avatars.com/api/?name=U&background=FF4500&color=fff'">
                            <div class="flex flex-col leading-tight">
                                <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Cuenta</span>
                                <span class="text-sm md:text-base font-black text-gray-900 truncate max-w-[100px] md:max-w-[150px] font-sans">${(store.user.full_name || 'Cliente').split(' ')[0]}</span>
                            </div>

                            <!-- Logout Small Dropdown/Tooltip -->
                            <div id="kiosk-user-menu" class="absolute top-[120%] right-0 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 hidden animate-bounce-in-up z-50">
                                <button onclick="kioskLogout()" class="w-full text-left p-4 hover:bg-red-50 text-red-500 rounded-xl transition flex items-center gap-3">
                                   <span class="text-xl">🚪</span>
                                   <span class="font-black text-xs uppercase tracking-widest">Cerrar Sesión</span>
                                </button>
                            </div>
                        </div>
                    ` : `
                        <button onclick="kioskLogout()" class="bg-gray-900 text-white font-black py-2.5 px-6 md:py-4 md:px-10 rounded-2xl shadow-lg hover:bg-black transition transform active:scale-95 text-[10px] md:text-sm tracking-widest uppercase">
                            SALIR
                        </button>
                    `}
                </div>
            </header>

            <!-- Product Grid -->
            <div class="flex-1 overflow-y-auto px-5 md:px-10 pb-32 pt-8 animate-fade-in custom-scrollbar">
                 ${filteredProducts.length === 0 ? `
                    <div class="h-64 flex flex-col items-center justify-center text-gray-400">
                        <span class="text-6xl mb-4">😿</span>
                        <p class="text-xl font-black text-gray-300 uppercase tracking-widest">Sin productos aquí</p>
                    </div>
                 ` : ''}
                 
                 <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 md:gap-x-10 gap-y-16 md:gap-y-20">
                     ${filteredProducts.map(p => {
        const outOfStock = (p.track_stock && p.stock <= 0) || p.is_available === false;
        return `
                        <div class="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-[0_20px_40px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)] transition-all duration-500 transform hover:-translate-y-2 cursor-pointer relative group border border-gray-50 flex flex-col" onclick="${outOfStock ? '' : `kioskOpenModal(${p.id})`}">
                             
                             <!-- Image floating effect -->
                             <div class="h-40 md:h-56 -mt-16 md:-mt-20 mb-4 relative flex items-center justify-center filter drop-shadow-2xl group-hover:drop-shadow-[0_25px_45px_rgba(0,0,0,0.15)] transition-all duration-500">
                                 <img src="${p.image_url}" class="max-h-full max-w-full object-contain transform group-hover:scale-105 transition-transform duration-500 ${outOfStock ? 'grayscale opacity-50' : ''}" onerror="this.src='https://placehold.co/400x400?text=Comida'">
                                 ${outOfStock ? `
                                    <div class="absolute inset-0 flex items-center justify-center">
                                        <span class="bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">Agotado</span>
                                    </div>
                                 ` : p.price < 20 ? `
                                    <div class="absolute -top-4 -right-2 bg-red-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg animate-pulse uppercase tracking-wider skew-x-[-10deg]">OFERTA</div>
                                 ` : ''}
                             </div>
                             
                             <div class="text-center flex-1 flex flex-col">
                                 <h3 class="font-black text-xl md:text-2xl text-gray-900 leading-tight mb-2 line-clamp-2 min-h-[3rem] transition-colors group-hover:text-primary">${p.name}</h3>
                                 
                                 <div class="mb-6">
                                     <div class="inline-flex items-baseline bg-orange-50 px-4 py-1.5 rounded-2xl">
                                        <span class="text-xs md:text-sm text-orange-400 font-black mr-1 uppercase">Bs.</span>
                                        <span class="text-3xl md:text-4xl font-black text-orange-500 tracking-tighter">${Math.floor(p.price)}</span>
                                        <span class="text-sm md:text-lg font-black text-orange-300 align-top ml-0.5">${(p.price % 1).toFixed(2).substring(1)}</span>
                                     </div>
                                 </div>
                                 
                                 <button class="w-full mt-auto ${outOfStock ? 'bg-gray-100 text-gray-400' : 'bg-gray-50 text-gray-900 group-hover:bg-primary group-hover:text-white shadow-sm group-hover:shadow-[0_10px_20px_rgba(255,68,0,0.2)]'} font-black text-sm md:text-base py-4 rounded-2xl transition-all duration-300 uppercase tracking-widest" ${outOfStock ? 'disabled' : ''}>
                                    ${outOfStock ? 'AGOTADO' : 'Personalizar'}
                                 </button>
                             </div>
                        </div>
                     `;
    }).join('')}
                 </div>
            </div>
        </main>
    </div>
    `;
}

/**
 * Icons Helper
 */
function getCatIcon(c) {
    const lower = c.toLowerCase();
    if (lower.includes('hamburguesa')) return '🍔';
    if (lower.includes('pollo')) return '🍗';
    if (lower.includes('bebida')) return '🥤';
    if (lower.includes('postre') || lower.includes('helado')) return '🍦';
    if (lower.includes('combo')) return '🥡';
    if (lower.includes('papas') || lower.includes('acompañante')) return '🍟';
    if (lower.includes('café') || lower.includes('cafe')) return '☕';
    return '🍴';
}

/**
 * Chat Component HTML
 */
/**
 * Chat Component HTML
 */
function renderKioskChat() {
    if (!kioskState.isChatOpen) return '';
    const targetOrderId = kioskState.lastOrderId;
    const isGeneral = !targetOrderId;

    return `
        <div class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 pointer-events-auto animate-fade-in" onclick="if(event.target === this) toggleKioskChat()" style="font-family: 'Outfit', sans-serif;">
            <div class="w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-in-bottom" style="height: 70vh; max-height: 550px;">
                <div class="px-5 py-4 bg-gray-900 text-white flex justify-between items-center flex-shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-xl">💬</div>
                        <div>
                            <p class="text-sm font-black text-white leading-none mb-1">
                                ${isGeneral ? 'Soporte HEHA' : `Pedido #${String(targetOrderId).slice(-3)}`}
                            </p>
                            <p class="text-[10px] text-primary font-bold uppercase tracking-widest">Respuesta en tiempo real</p>
                        </div>
                    </div>
                    <button onclick="toggleKioskChat()" class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition text-sm">✕</button>
                </div>
                
                <div id="chat-messages" class="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/50 scrollbar-hide">
                    ${renderKioskChatMessages()}
                </div>

                <form onsubmit="sendKioskMessage(event)" class="p-4 bg-white border-t border-gray-100 flex gap-3 flex-shrink-0">
                    <input id="chat-input" type="text" placeholder="Escribe un mensaje..." required
                           class="flex-1 px-4 py-3.5 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none text-sm font-semibold">
                    <button type="submit" class="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center transition active:scale-90 shadow-lg shadow-primary/20">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    </button>
                </form>
            </div>
        </div>
    `;
}

function renderKioskChatMessages() {
    if (kioskState.messages.length === 0) {
        return `
            <div class="h-full flex flex-col items-center justify-center text-center text-gray-300 px-6 py-10">
                <div class="w-20 h-20 bg-gray-100/50 rounded-full flex items-center justify-center mb-4">
                    <span class="text-4xl opacity-50">💬</span>
                </div>
                <p class="text-sm font-black uppercase tracking-widest text-gray-400">Sin mensajes</p>
                <p class="text-xs text-gray-300 mt-1">Envía un hola para comenzar</p>
            </div>
        `;
    }

    return kioskState.messages.map(m => {
        const myFullName = store.user?.full_name || store.customerName || 'Cliente';
        const isMe = m.sender_name === myFullName;
        const firstName = m.sender_name.split(' ')[0];
        
        // Avatar logic: Try to get from store if it's me, or use a generic one
        let avatarUrl = 'https://ui-avatars.com/api/?name=' + firstName + '&background=random&color=fff';
        if (isMe && store.user?.user_metadata?.avatar_url) avatarUrl = store.user.user_metadata.avatar_url;
        if (isMe && store.user?.user_metadata?.picture) avatarUrl = store.user.user_metadata.picture;

        return `
            <div class="flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} mb-2">
                <div class="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden border-2 border-white shadow-sm">
                    <img src="${avatarUrl}" class="w-full h-full object-cover">
                </div>
                <div class="max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                    <span class="text-[9px] font-black uppercase tracking-tighter text-gray-400 mb-1 px-1">${firstName}</span>
                    <div class="px-4 py-3 rounded-2xl shadow-sm text-sm ${isMe ? 'bg-gray-900 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}">
                        <p class="font-medium leading-relaxed">${m.message}</p>
                    </div>
                    <span class="text-[7px] font-bold text-gray-300 uppercase mt-1 px-1">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
        `;
    }).join('');
}

function updateKioskChatUI() {
    const list = document.getElementById('chat-messages');
    if (list) {
        list.innerHTML = renderKioskChatMessages();
        list.scrollTop = list.scrollHeight;
    } else {
        // If chat is open but container not found (hidden by wrapper logic), full refresh as fallback
        if (kioskState.isChatOpen) window.renderKioskInstance();
    }
}

/**
 * Chat Realtime Setup
 */
function setupKioskChatRealtime(container) {
    const filterId = kioskState.lastOrderId || null;
    const channelName = `chat-${filterId || 'general'}`;
    
    if (window.activeChatChannel === channelName) return;
    
    // Cleanup old sub
    if (window.chatSubscription) {
        window.chatSubscription.unsubscribe();
    }
    window.activeChatChannel = channelName;

    window.chatSubscription = supabase
        .channel(channelName)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'order_messages',
            filter: filterId ? `order_id=eq.${filterId}` : `order_id=is.null`
        }, (payload) => {
            kioskState.messages.push(payload.new);
            if (payload.new.sender_name !== (store.user?.full_name || store.customerName || 'Cliente')) {
                 if (window.playNotificationSound) window.playNotificationSound();
            }
            updateKioskChatUI();
        })
        .subscribe();
    
    // Initial Fetch
    const fetchMessages = async () => {
         let query = supabase.from('order_messages').select('*').order('created_at', { ascending: true });
         if (filterId) query = query.eq('order_id', filterId);
         else query = query.is('order_id', null);
         
         const { data } = await query;
         if (data) {
             kioskState.messages = data;
             updateKioskChatUI();
         }
    };
    fetchMessages();
}

/**
 * Order Status Realtime Setup
 */
function setupOrderStatusRealtime(container) {
    if (!kioskState.lastOrderId || window.orderStatusSub) return;

    window.orderStatusSub = supabase
        .channel(`order-status-${kioskState.lastOrderId}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'orders',
            filter: `id=eq.${kioskState.lastOrderId}`
        }, (payload) => {
            const newStatus = payload.new.status;
            const newKitchenStatus = payload.new.kitchen_status;
            let changed = false;
            if (newStatus && newStatus !== kioskState.orderStatus) {
                kioskState.orderStatus = newStatus;
                changed = true;
            }
            if (newKitchenStatus && newKitchenStatus !== kioskState.kitchenStatus) {
                kioskState.kitchenStatus = newKitchenStatus;
                changed = true;
            }
            if (changed) {
                saveActiveOrder();
                window.renderKioskInstance();
            }
        })
        .subscribe();
}

/**
 * Product Modal Component
 */
function renderProductModal(container) {
    const p = kioskState.modalProduct;
    if (!p) return;

    const modalHTML = `
      <div id="kiosk-modal-overlay" class="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-fade-in" onclick="if(event.target === this) kioskCloseModal()" style="font-family: 'Outfit', sans-serif;">
         <div class="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col animate-slide-in-bottom sm:animate-scale-up relative" style="max-height: 92vh;">
            
            <!-- Image Section -->
            <div class="relative bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center" style="height: 200px;">
               <img src="${p.image_url}" class="max-h-[170px] max-w-[80%] object-contain drop-shadow-xl" onerror="this.src='https://placehold.co/400x400?text=HEHA'">
               <button onclick="kioskCloseModal()" class="absolute top-3 right-3 w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center hover:scale-110 active:scale-90 transition-transform border border-gray-200">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
               </button>
               ${p.track_stock ? `
                  <div class="absolute top-3 left-3 ${p.stock > 0 ? 'bg-green-500' : 'bg-red-500'} text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                     ${p.stock > 0 ? `${p.stock} disponibles` : 'Agotado'}
                  </div>
               ` : ''}
            </div>
            
            <!-- Info Section -->
            <div class="px-5 pt-5 pb-2">
               <h2 class="text-xl font-extrabold text-gray-900 leading-snug mb-1">${p.name}</h2>
               <p class="text-sm text-gray-400 leading-relaxed mb-4 line-clamp-2">${p.description || 'Preparado al momento con ingredientes frescos y el sello HEHA.'}</p>
               <div class="flex items-baseline gap-1 mb-5">
                  <span class="text-sm font-bold text-gray-400">Bs.</span>
                  <span class="text-3xl font-extrabold text-gray-900 tracking-tight">${p.price}</span>
               </div>
            </div>

            <!-- Actions Section -->
            <div class="px-5 pb-5 pt-0">
               <div class="flex items-center gap-3">
                  <!-- Qty Selector -->
                  <div class="flex items-center bg-gray-100 rounded-2xl h-14 flex-shrink-0">
                     <button onclick="updateModalQty(-1)" class="w-14 h-14 flex items-center justify-center text-xl font-bold text-gray-400 hover:text-gray-900 active:scale-90 transition-all rounded-2xl hover:bg-gray-200">−</button>
                     <span id="modal-qty" class="w-8 text-center text-xl font-extrabold text-gray-900">1</span>
                     <button onclick="updateModalQty(1)" class="w-14 h-14 flex items-center justify-center text-xl font-bold text-gray-400 hover:text-gray-900 active:scale-90 transition-all rounded-2xl hover:bg-gray-200">+</button>
                  </div>
                  
                  <!-- Add Button -->
                  <button onclick="kioskConfirmAdd(${p.id})" 
                          data-price="${p.price}"
                          ${p.track_stock && p.stock <= 0 ? 'disabled' : ''}
                          class="flex-1 h-14 ${p.track_stock && p.stock <= 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-primary text-white active:scale-[0.98] hover:brightness-110 shadow-lg shadow-primary/25'} font-bold text-base rounded-2xl transition-all flex items-center justify-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
                      <span>${p.track_stock && p.stock <= 0 ? 'Agotado' : 'Agregar'}</span>
                      <span class="font-extrabold">Bs.${p.price}</span>
                  </button>
               </div>
            </div>
         </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    container.appendChild(div.firstElementChild);

    window.updateModalQty = (delta) => {
        const el = document.getElementById('modal-qty');
        let v = parseInt(el.innerText) + delta;
        if (v < 1) v = 1;
        el.innerText = v;
        
        // Update button price dynamically
        const addBtn = document.querySelector('button[onclick*="kioskConfirmAdd"]');
        if (addBtn) {
            const priceSpan = addBtn.querySelector('span:last-child');
            const unitPrice = parseFloat(addBtn.dataset.price || 0);
            if (priceSpan && unitPrice) priceSpan.textContent = 'Bs.' + (v * unitPrice).toFixed(0);
        }
    };
}


/**
 * Toast Helper
 */
function showKioskToast(msg) {
    const container = document.getElementById('kiosk-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'bg-gray-900 text-white px-8 py-5 rounded-[1.5rem] shadow-[0_25px_50px_rgba(0,0,0,0.3)] flex items-center gap-4 animate-slide-in-bottom border border-white/10 backdrop-blur-md bg-opacity-90';
    toast.innerHTML = `<div class="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center"><span class="text-green-500 text-xl font-black">✓</span></div> <span class="font-black text-sm uppercase tracking-widest">${msg}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Cart Screen
 */
function renderCartScreen(container) {
    const total = store.cartTotal;
    const itemCount = store.cart.reduce((s, i) => s + i.quantity, 0);

    container.innerHTML = `
      <div class="h-full flex flex-col bg-white" style="font-family: 'Outfit', sans-serif;">
         <!-- Header -->
         <header class="flex items-center gap-4 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-20">
             <button onclick="setKioskScreen('menu')" class="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center active:scale-95">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
             </button>
             <div class="flex-1">
                <h1 class="text-lg font-extrabold text-gray-900">Tu Pedido</h1>
                <p class="text-xs text-gray-400">${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}</p>
             </div>
         </header>
         
         <!-- Scrollable Content -->
         <main class="flex-1 overflow-y-auto">
            
            <!-- Cart Items -->
            <div class="px-4 py-4 space-y-3">
                ${store.cart.length === 0 ? `
                    <div class="text-center py-16">
                        <span class="text-6xl block mb-4">🛒</span>
                        <p class="text-gray-300 font-bold text-lg mb-6">Tu carrito está vacío</p>
                        <button onclick="setKioskScreen('menu')" class="bg-primary text-white font-bold px-8 py-3 rounded-xl shadow-lg active:scale-95 transition">Ver Menú</button>
                    </div>
                ` : store.cart.map(item => `
                    <div class="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                        <div class="w-16 h-16 rounded-xl bg-white overflow-hidden flex-shrink-0 border border-gray-100 p-1">
                            <img src="${item.product.image_url}" class="w-full h-full object-contain" onerror="this.src='https://placehold.co/100'">
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="text-sm font-bold text-gray-900 leading-tight mb-0.5">${item.product.name}</h3>
                            <p class="text-sm font-extrabold text-primary">Bs. ${(item.product.price * item.quantity).toFixed(2)}</p>
                        </div>
                        <div class="flex items-center gap-0 bg-white rounded-xl border border-gray-200 flex-shrink-0">
                            <button onclick="kioskUpdateQty('${item.product.id}', -1)" class="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 text-lg font-bold transition active:scale-90">−</button>
                            <span class="w-7 text-center text-sm font-extrabold text-gray-900">${item.quantity}</span>
                            <button onclick="kioskUpdateQty('${item.product.id}', 1)" class="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-900 text-lg font-bold transition active:scale-90">+</button>
                        </div>
                    </div>
                `).join('')}
            </div>

            ${store.cart.length > 0 ? `
            <!-- Divider -->
            <div class="h-2 bg-gray-50"></div>

            <!-- Delivery Options -->
            <div class="px-4 py-4">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tipo de pedido</p>
                <div class="grid grid-cols-2 gap-2 mb-4">
                    <button onclick="setDiningOption('eat-in')" class="py-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${kioskState.diningOption === 'eat-in' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 bg-gray-50 text-gray-400'}">
                        🍽️ En Mesa
                    </button>
                    <button onclick="setDiningOption('takeout')" class="py-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${kioskState.diningOption === 'takeout' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 bg-gray-50 text-gray-400'}">
                        🛍️ Para Llevar
                    </button>
                </div>

                <!-- Schedule Toggle -->
                <div class="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div class="flex items-center gap-3">
                        <span class="text-lg">🕒</span>
                        <div>
                            <p class="text-xs font-bold text-gray-800">¿Reservar para después?</p>
                        </div>
                    </div>
                    <button onclick="toggleKioskReservation()" class="relative inline-flex h-7 w-12 items-center rounded-full transition-all ${kioskState.isReservation ? 'bg-primary' : 'bg-gray-200'}">
                        <span class="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${kioskState.isReservation ? 'translate-x-[22px]' : 'translate-x-[3px]'}"></span>
                    </button>
                </div>
                ${kioskState.isReservation ? `
                    <div class="mt-2 bg-gray-900 rounded-xl p-4 flex items-center justify-between gap-4 animate-slide-in-bottom">
                        <div>
                            <p class="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Hora de entrega</p>
                            <p class="text-[10px] text-gray-400">Preparamos tu orden a tiempo</p>
                        </div>
                        <input type="time" id="reservation-time" 
                               value="${kioskState.reservationTime || ''}"
                               onchange="updateKioskReservationTime(this.value)"
                               class="p-2 rounded-lg bg-white/10 text-white border border-white/10 font-bold text-lg text-center focus:ring-2 focus:ring-primary outline-none w-28">
                    </div>
                ` : ''}
            </div>

            <!-- Divider -->
            <div class="h-2 bg-gray-50"></div>

            <!-- Customer & Summary -->
            <div class="px-4 py-4">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                        ${store.user?.user_metadata?.avatar_url ? `<img src="${store.user.user_metadata.avatar_url}" class="w-full h-full object-cover">` : '<span class="text-lg">👤</span>'}
                    </div>
                    <div>
                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cliente</p>
                        <p class="text-sm font-extrabold text-gray-900 capitalize">${store.user?.full_name || 'Invitado'}</p>
                    </div>
                </div>
                
                <div class="flex justify-between text-sm text-gray-400 font-bold mb-2">
                    <span>Subtotal</span>
                    <span>Bs. ${total.toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-xl font-extrabold text-gray-900 pt-2 border-t border-gray-100">
                    <span>Total</span>
                    <span class="text-primary">Bs. ${total.toFixed(2)}</span>
                </div>
            </div>
            ` : ''}
         </main>

         ${store.cart.length > 0 ? `
         <!-- Sticky Checkout Button -->
         <div class="px-4 pb-4 pt-2 border-t border-gray-100 bg-white">
             <button onclick="kioskCheckout()" class="w-full h-14 bg-primary text-white font-bold text-lg rounded-2xl shadow-lg shadow-primary/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:brightness-110">
                 <span>Confirmar Pedido</span>
                 <span class="font-extrabold">· Bs. ${total.toFixed(2)}</span>
             </button>
         </div>
         ` : ''}
      </div>
    `;

    window.kioskUpdateQty = (id, delta) => {
        store.updateCartQuantity(id, delta);
        window.renderKioskInstance();
    };

    window.setDiningOption = (opt) => {
        kioskState.diningOption = opt;
        window.renderKioskInstance();
    };

    window.toggleKioskReservation = () => {
        kioskState.isReservation = !kioskState.isReservation;
        window.renderKioskInstance();
    };

    window.updateKioskReservationTime = (time) => {
        kioskState.reservationTime = time;
    };
}


function renderSuccessScreen(container) {
    const status = kioskState.orderStatus || 'pending';
    const orderNum = String(kioskState.lastOrderId).slice(-3);

    // Determine the display state
    // pending = waiting for cashier
    // completed = cashier accepted/paid, food being prepared
    // ready = kitchen finished, pick up order
    // rejected = order rejected
    let displayStatus = status;
    if (status === 'completed' && kioskState.kitchenStatus === 'ready') {
        displayStatus = 'ready';
    } else if (status === 'completed') {
        displayStatus = 'accepted';
    }

    // Status configurations
    const statusConfig = {
        pending: {
            bg: 'from-amber-400 to-amber-600',
            icon: kioskState.isReservation ? '⏳' : '💰',
            title: kioskState.isReservation ? 'RESERVA ENVIADA' : 'DIRÍGETE A CAJA',
            subtitle: kioskState.isReservation 
                ? 'Estamos revisando tu reserva. Espera la confirmación aquí.' 
                : 'Acércate a caja con tu número de pedido para pagar y confirmar tu orden.',
            statusText: 'PENDIENTE',
            statusColor: 'text-amber-600',
            badgeColor: 'bg-amber-400',
            pulse: true
        },
        accepted: {
            bg: 'from-green-500 to-green-700',
            icon: '✅',
            title: '¡ACEPTADO!',
            subtitle: 'Tu pedido está siendo preparado en cocina',
            statusText: 'EN PREPARACIÓN',
            statusColor: 'text-green-600',
            badgeColor: 'bg-green-400',
            pulse: true
        },
        ready: {
            bg: 'from-blue-500 to-blue-700',
            icon: '🍔',
            title: '¡PEDIDO LISTO!',
            subtitle: 'Pasa a recoger tu orden por el mostrador',
            statusText: 'LISTO PARA RECOGER',
            statusColor: 'text-blue-600',
            badgeColor: 'bg-blue-400',
            pulse: false
        },
        rejected: {
            bg: 'from-red-500 to-red-700',
            icon: '❌',
            title: 'PEDIDO RECHAZADO',
            subtitle: 'Lo sentimos, no podemos procesar tu pedido en este momento',
            statusText: 'RECHAZADO',
            statusColor: 'text-red-600',
            badgeColor: 'bg-red-400',
            pulse: false
        }
    };

    const cfg = statusConfig[displayStatus] || statusConfig.pending;
    const isFinished = displayStatus === 'ready' || displayStatus === 'rejected';

    container.innerHTML = `
      <div class="h-full w-full flex flex-col bg-gradient-to-br ${cfg.bg} text-white" style="font-family: 'Outfit', sans-serif;">
         
         <!-- Background Deco -->
         <div class="absolute top-0 left-0 w-48 h-48 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
         <div class="absolute bottom-0 right-0 w-64 h-64 bg-black/10 rounded-full translate-x-1/3 translate-y-1/3"></div>

         <!-- Main Content (Scrollable) -->
         <div class="flex-1 flex flex-col items-center justify-center px-4 py-6 relative z-10 overflow-y-auto">
              
              <!-- Status Icon -->
              <div class="bg-white/20 backdrop-blur-md rounded-full w-20 h-20 flex items-center justify-center text-4xl mb-4 ${cfg.pulse ? 'animate-pulse' : ''} shadow-xl">
                 ${cfg.icon}
              </div>
              
              <!-- Title -->
              <h1 class="text-3xl sm:text-4xl font-extrabold text-center tracking-tight uppercase mb-2 drop-shadow-lg leading-tight">
                 ${cfg.title}
              </h1>
              <p class="text-base sm:text-lg opacity-90 text-center mb-6 max-w-xs">
                 ${cfg.subtitle}
              </p>
              
              <!-- Order Card -->
              <div class="bg-white text-gray-900 rounded-3xl p-6 shadow-2xl w-full max-w-xs relative">
                 <div class="absolute -top-3 left-1/2 -translate-x-1/2 ${cfg.badgeColor} text-black px-4 py-1 rounded-full font-bold text-[10px] tracking-widest uppercase shadow-md">
                     Tu Número de Orden
                 </div>
                 <p class="text-6xl font-extrabold tracking-tighter text-center mt-2 mb-3">
                     #${orderNum}
                 </p>
                 <div class="w-full h-px bg-gray-100 mb-3"></div>
                 <div class="flex items-center justify-center gap-2">
                     <span class="w-2 h-2 rounded-full ${cfg.pulse ? 'animate-ping' : ''} ${cfg.badgeColor.replace('bg-', 'bg-')}"></span>
                     <p class="text-sm font-bold uppercase tracking-widest ${cfg.statusColor}">${cfg.statusText}</p>
                 </div>
              </div>

              ${displayStatus === 'pending' || displayStatus === 'accepted' ? `
              <!-- Waiting Animation -->
              <div class="mt-6 flex items-center gap-2 opacity-70">
                  <div class="w-2 h-2 bg-white rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                  <div class="w-2 h-2 bg-white rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                  <div class="w-2 h-2 bg-white rounded-full animate-bounce" style="animation-delay: 300ms"></div>
              </div>
              ` : ''}
         </div>

         <!-- Bottom Actions (Sticky) -->
         <div class="px-4 pb-4 pt-2 relative z-10 space-y-2">
              <!-- Chat Button (Always visible) -->
              <button onclick="toggleKioskChat()" class="w-full h-14 bg-white/20 backdrop-blur-md text-white font-bold text-base rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] border border-white/20">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                  <span>Chat con el Cajero</span>
                  ${kioskState.messages.length > 0 ? '<span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>' : ''}
              </button>

              ${isFinished ? `
              <!-- New Order Button (only when finished) -->
              <button onclick="kioskFinish()" class="w-full h-14 bg-white text-gray-900 font-bold text-base rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                  <span>Nuevo Pedido</span>
              </button>
              ` : ''}
         </div>
      </div>
    `;

    window.kioskFinish = () => {
        store.clearCart();
        clearActiveOrder();
        kioskState.lastOrderId = null;
        kioskState.orderStatus = 'pending';
        kioskState.messages = [];
        // Cleanup obs
        if (window.orderStatusSub) {
            window.orderStatusSub.unsubscribe();
            window.orderStatusSub = null;
        }
        setKioskScreen('menu');
    };
}

/**
 * Global Helpers
 */
window.kioskSetCategory = (cat) => {
    kioskState.activeCategory = cat;
    window.renderKioskInstance();
};

window.kioskOpenModal = (id) => {
    const products = kioskCache.products || [];
    const p = products.find(x => x.id === id);
    if (p) {
        kioskState.modalProduct = p;
        const container = document.getElementById('app');
        if (container) renderKiosk(container);
    }
};

window.kioskCloseModal = () => {
    kioskState.modalProduct = null;
    const container = document.getElementById('app');
    if (container) renderKiosk(container);
};

window.kioskConfirmAdd = (id) => {
    const products = kioskCache.products || [];
    const p = products.find(x => x.id === id);
    if (p) {
        const qtyInput = document.getElementById('modal-qty');
        const qty = qtyInput ? parseInt(qtyInput.innerText) : 1;
        if (p.track_stock && p.stock < qty) {
            showKioskToast(`⚠️ Solo quedan ${p.stock} unidades`);
            return;
        }
        store.addToCart(p, qty);
        kioskState.modalProduct = null;
        window.renderKioskInstance();
        showKioskToast(`+${qty} ${p.name} agregado`);
    }
};

window.toggleKioskChat = () => {
    kioskState.isChatOpen = !kioskState.isChatOpen;
    window.renderKioskInstance();
    if (kioskState.isChatOpen) {
        setTimeout(() => {
            const msgs = document.getElementById('chat-messages');
            if (msgs) msgs.scrollTop = msgs.scrollHeight;
        }, 100);
    }
};

window.sendKioskMessage = async (e) => {
    if (e) e.preventDefault();
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    input.value = ''; // Instant feedback
    const customerName = store.user?.full_name || store.customerName || 'Cliente';
    
    // Auto-scroll to bottom immediately for better UX
    setTimeout(() => {
        const msgs = document.getElementById('chat-messages');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 10);

    const { error } = await supabase.from('order_messages').insert({
        order_id: kioskState.lastOrderId, 
        sender_name: customerName,
        message: msg
    });

    if (error) {
        alert("Error al enviar: " + error.message);
        input.value = msg; // Restore if failed
    }
};

window.kioskCheckout = async () => {
    if (store.cart.length === 0) return;
    const customerName = store.user?.full_name || store.customerName;
    if (!customerName) {
        alert("Por favor, inicia sesión para realizar tu pedido.");
        return;
    }
    let scheduledTime = null;
    if (kioskState.isReservation && kioskState.reservationTime) {
        const [h, m] = kioskState.reservationTime.split(':');
        const d = new Date();
        d.setHours(parseInt(h), parseInt(m), 0, 0);
        scheduledTime = d.toISOString();
    }
    const orderData = {
        total_amount: store.cartTotal,
        order_type: kioskState.diningOption === 'eat-in' ? 'mesa' : 'llevar',
        status: 'pending',
        payment_method: 'pendiente',
        customer_name: customerName,
        created_at: new Date().toISOString(),
        scheduled_time: scheduledTime,
        cashier_name: 'Kiosco'
    };
    const { data, error } = await supabase.from('orders').insert(orderData).select().single();
    if (data) {
        const items = store.cart.map(item => ({
            order_id: data.id,
            product_id: item.product.id,
            quantity: item.quantity,
            price_at_sale: item.product.price
        }));
        await supabase.from('order_items').insert(items);
        kioskState.lastOrderId = data.id;
        kioskState.orderStatus = 'pending';
        kioskState.messages = []; // Clear for new order context
        saveActiveOrder();
        setKioskScreen('success');
    } else {
        alert("Error al procesar: " + error.message);
    }
};

window.setKioskScreen = (screen) => {
    kioskState.screen = screen;
    const container = document.getElementById('app');
    if (container) renderKiosk(container);
};

window.toggleKioskUserMenu = () => {
    const el = document.getElementById('kiosk-user-menu');
    if (el) el.classList.toggle('hidden');
};

window.kioskLogout = async () => {
    if (confirm("¿Estás seguro que deseas cerrar sesión?")) {
        await store.logout();
        store.customerName = '';
        location.reload(); // Hard reset for clean state
    }
};

let productsSubscription = null;
function setupKioskProductsRealtime(container) {
    if (productsSubscription) return;

    productsSubscription = supabase
        .channel('kiosk-products-realtime')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'products' },
            async (payload) => {
                console.log('Product change detected:', payload);
                // Refresh local cache
                const { data } = await supabase.from('products').select('*');
                if (data) {
                    kioskCache.products = data;
                    // Only re-render if we are on the menu screen
                    if (kioskState.screen === 'menu') {
                        renderMenuScreen(container);
                    }
                }
            }
        )
        .subscribe();
}
