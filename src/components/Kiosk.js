import { store } from '../store.js';
import { supabase } from '../services/supabase.js';
import { generateReceiptHTML, printTicket } from '../utils/printer.js';

// Estado interno del Kiosco
let kioskState = {
    screen: 'menu', // menu, cart, success
    diningOption: 'eat-in', // eat-in, takeout
    isReservation: false,
    reservationTime: '',
    lastOrderId: null,
    activeCategory: 'Todos',
    modalProduct: null, // Product Object if modal is open
    isChatOpen: false,
    messages: [],
    orderStatus: 'pending' // pending, completed, cancelled
};

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
            
            <nav class="flex flex-col gap-4 md:gap-6 w-full px-2">
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
        const outOfStock = p.track_stock && p.stock <= 0;
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
            
            <!-- Floating Cart Summary -->
            ${cartQty > 0 ? `
                <div class="absolute bottom-6 right-6 md:bottom-12 md:right-12 z-30 animate-slide-in-bottom">
                    <button onclick="setKioskScreen('cart')" class="bg-primary hover:bg-orange-600 text-white py-4 px-6 md:py-6 md:px-12 rounded-[2.5rem] shadow-[0_20px_50px_rgba(255,68,0,0.4)] flex items-center gap-4 md:gap-8 transition-all duration-300 transform hover:scale-105 active:scale-95 ring-[12px] ring-white/30 backdrop-blur-sm">
                        <div class="flex flex-col items-start leading-none">
                             <span class="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-1">Tu Pedido</span>
                             <span class="text-2xl md:text-4xl font-black">Bs. ${store.cartTotal.toFixed(2)}</span>
                        </div>
                        <div class="bg-white text-primary w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center font-black text-xl md:text-3xl shadow-inner">
                            ${cartQty}
                        </div>
                    </button>
                </div>
            ` : ''}
        </main>
    </div>
    `;

    // Global Helpers for this screen (ensure they use container)
    window.renderKioskInstance = () => renderKiosk(container, true);
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
function renderKioskChat() {
    // Determine target ID (General or Specific Order)
    const targetOrderId = kioskState.lastOrderId;
    const isGeneral = !targetOrderId;

    return `
        <div class="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 pointer-events-auto">
            ${kioskState.isChatOpen ? `
                <div class="w-[320px] md:w-[400px] h-[450px] bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-bounce-in-up">
                    <div class="p-6 bg-black text-white flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-xl">👨‍🍳</div>
                            <div>
                                <p class="text-xs font-black uppercase tracking-widest text-primary">
                                    ${isGeneral ? 'Consultas HEHA' : `Ayuda Pedido #${String(targetOrderId).slice(-3)}`}
                                </p>
                                <p class="text-[10px] text-gray-400 font-bold">Respuesta en tiempo real</p>
                            </div>
                        </div>
                        <button onclick="toggleKioskChat()" class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition">✕</button>
                    </div>
                    
                    <div id="chat-messages" class="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50 scrollbar-hide">
                        ${kioskState.messages.length === 0 ? `
                            <div class="h-full flex flex-col items-center justify-center text-center text-gray-300 px-8">
                                <span class="text-4xl mb-4">💬</span>
                                <p class="text-sm font-bold text-gray-400">${isGeneral ? '¡Hola! Escríbenos si tienes alguna duda antes de pedir.' : '¡Hola! Escríbenos aquí si tienes dudas sobre tu reserva.'}</p>
                            </div>
                        ` : kioskState.messages.map(m => {
        const isMe = m.sender_name === (store.user?.full_name || store.customerName || 'Cliente');
        return `
                                <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                                    <div class="max-w-[80%] p-4 rounded-2xl text-sm font-medium ${isMe ? 'bg-black text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none shadow-sm'}">
                                        <p class="${isMe ? 'text-primary' : 'text-gray-400'} text-[9px] font-black uppercase tracking-widest mb-1">${m.sender_name}</p>
                                        <p>${m.message}</p>
                                    </div>
                                </div>
                            `;
    }).join('')}
                    </div>

                    <form onsubmit="sendKioskMessage(event)" class="p-4 bg-white border-t border-gray-100 flex gap-2">
                        <input id="chat-input" type="text" placeholder="Escribe un mensaje..." required
                               class="flex-1 p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold">
                        <button type="submit" class="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center transition active:scale-95 shadow-lg shadow-black/10">
                            🚀
                        </button>
                    </form>
                </div>
            ` : `
                <button onclick="toggleKioskChat()" class="w-16 h-16 bg-black text-white rounded-full shadow-2xl flex items-center justify-center text-3xl transition transform hover:scale-110 active:scale-95 group relative shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
                    <span class="absolute -top-1 -right-1 w-5 h-5 bg-primary border-4 border-white rounded-full animate-pulse ${kioskState.messages.length > 0 ? '' : 'hidden'}"></span>
                    💬
                </button>
            `}
        </div>
    `;
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
            window.renderKioskInstance();
            setTimeout(() => {
                const msgs = document.getElementById('chat-messages');
                if (msgs) msgs.scrollTop = msgs.scrollHeight;
            }, 100);
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
             window.renderKioskInstance();
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
            if (newStatus !== kioskState.orderStatus) {
                kioskState.orderStatus = newStatus;
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
      <div id="kiosk-modal-overlay" class="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-6 animate-fade-in bg-black/80 backdrop-blur-md" onclick="if(event.target === this) kioskCloseModal()" style="font-family: 'Outfit', sans-serif;">
         <div class="bg-[#f8f8f8] w-full max-w-2xl rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh] animate-slide-in-bottom border border-white/10">
            <div class="h-64 md:h-96 relative flex items-center justify-center p-8 md:p-12 bg-white/20">
               <img src="${p.image_url}" class="max-h-full max-w-full object-contain filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.2)] transform scale-110" onerror="this.src='https://placehold.co/400x400?text=Comida'">
               <button onclick="kioskCloseModal()" class="absolute top-6 right-6 bg-white/90 backdrop-blur-sm p-4 rounded-full shadow-xl hover:scale-110 active:scale-95 transition text-gray-900 font-black z-10 flex items-center justify-center w-12 h-12 md:w-16 md:h-16 border border-white">
                  ✕
               </button>
            </div>
            
            <div class="p-8 md:p-12 flex-1 flex flex-col bg-white rounded-t-[3.5rem] -mt-12 shadow-[0_-20px_50px_rgba(0,0,0,0.08)] relative z-0 overflow-y-auto custom-scrollbar">
               <div class="flex flex-col md:flex-row justify-between items-start mb-6 md:mb-8 gap-4">
                  <div class="flex-1">
                      <h2 class="text-3xl md:text-5xl font-black text-gray-900 leading-none uppercase tracking-tight mb-3">${p.name}</h2>
                      ${p.track_stock ? `
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full ${p.stock > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'}"></span>
                            <span class="text-[10px] md:text-xs font-black text-gray-400 border-gray-100 uppercase tracking-widest">
                                ${p.stock > 0 ? `${p.stock} EN TIENDA` : 'SIN EXISTENCIA'}
                            </span>
                          </div>
                      ` : ''}
                  </div>
                  <div class="bg-primary/5 px-6 py-3 rounded-2xl border border-primary/10">
                      <span class="text-3xl md:text-5xl font-black text-primary tracking-tighter">
                        <span class="text-base md:text-2xl text-primary/60 font-black mr-1 uppercase">Bs.</span>${p.price}
                      </span>
                  </div>
               </div>
               
               <p class="text-gray-500 text-base md:text-xl font-medium mb-8 md:mb-12 leading-relaxed opacity-80">${p.description || 'Deliciosa opción preparada al momento con los mejores ingredientes y el toque auténtico de HEHA.'}</p>
               
               <div class="bg-gray-50 rounded-[2.5rem] p-6 md:p-8 mt-auto border border-gray-100">
                    <div class="flex flex-col sm:flex-row items-center justify-between gap-6 md:gap-10">
                        <div class="flex items-center bg-white rounded-3xl shadow-inner p-2 md:p-3 border border-gray-100 w-full sm:w-auto justify-center gap-4">
                             <button onclick="updateModalQty(-1)" class="w-14 h-14 md:w-20 md:h-20 bg-gray-50 text-gray-300 hover:text-red-500 rounded-2xl text-4xl font-black transition active:scale-90 flex items-center justify-center">-</button>
                             <span id="modal-qty" class="text-4xl md:text-5xl font-[1000] w-14 md:w-20 text-center text-gray-900 tracking-tighter">1</span>
                             <button onclick="updateModalQty(1)" class="w-14 h-14 md:w-20 md:h-20 bg-gray-50 text-gray-300 hover:text-green-500 rounded-2xl text-4xl font-black transition active:scale-90 flex items-center justify-center">+</button>
                        </div>
                        
                        <button onclick="kioskConfirmAdd(${p.id})" 
                                ${p.track_stock && p.stock <= 0 ? 'disabled' : ''}
                                class="w-full sm:flex-1 h-16 md:h-24 ${p.track_stock && p.stock <= 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-primary text-white hover:bg-orange-600 shadow-[0_15px_30px_rgba(255,68,0,0.35)] active:scale-95'} font-black text-xl md:text-3xl rounded-[1.8rem] md:rounded-[2.2rem] transition-all flex items-center justify-center gap-4 group">
                            <span>${p.track_stock && p.stock <= 0 ? 'AGOTADO' : 'AGREGAR'}</span>
                            <span class="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-xl flex items-center justify-center text-sm md:text-lg group-hover:translate-x-1 transition-transform">➔</span>
                        </button>
                    </div>
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

    container.innerHTML = `
      <div class="h-full flex flex-col bg-[#f8f8f8] font-sans" style="font-family: 'Outfit', sans-serif;">
         <header class="bg-white/70 backdrop-blur-md p-6 md:p-10 flex items-center gap-6 md:gap-10 sticky top-0 z-20 border-b border-gray-100">
             <button onclick="setKioskScreen('menu')" class="p-5 md:p-6 rounded-[2rem] bg-gray-100 hover:bg-gray-200 transition transform hover:scale-105 active:scale-95 shadow-sm">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 md:h-10 md:w-10 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             </button>
             <div>
                <h1 class="text-3xl md:text-6xl font-[1000] text-gray-900 uppercase tracking-tighter leading-none">Tu Pedido</h1>
                <p class="text-gray-400 font-bold text-xs md:text-lg uppercase tracking-[0.3em] mt-1 opacity-70">Casi listo para disfrutar</p>
             </div>
         </header>
         
         <main class="flex-1 overflow-y-auto p-6 md:p-12 animate-fade-in custom-scrollbar">
            <div class="max-w-6xl mx-auto flex flex-col lg:flex-row gap-10 md:gap-16">
                <!-- Items List -->
                <div class="flex-1 space-y-6">
                    ${store.cart.length === 0 ? `
                        <div class="bg-white rounded-[3rem] p-16 md:p-24 text-center shadow-sm border border-gray-50 flex flex-col items-center">
                            <span class="text-8xl md:text-9xl block mb-6 animate-bounce">🛒</span>
                            <h3 class="text-2xl md:text-4xl font-black text-gray-300 uppercase tracking-widest">Tu carrito está vacío</h3>
                            <button onclick="setKioskScreen('menu')" class="mt-8 bg-primary text-white font-black px-10 py-5 rounded-3xl shadow-xl hover:scale-105 transition active:scale-95 uppercase tracking-widest text-sm">Empezar Pedido</button>
                        </div>
                    ` : store.cart.map(item => `
                        <div class="flex items-center bg-white p-4 md:p-6 rounded-[2.5rem] shadow-[0_15px_35px_rgba(0,0,0,0.02)] border border-gray-50 hover:border-primary/20 transition-all duration-300 pr-6">
                            <div class="h-24 w-24 md:h-40 md:w-40 rounded-3xl bg-gray-50 overflow-hidden flex-shrink-0 mr-6 md:mr-10 relative shadow-inner p-2 border border-gray-100">
                                <img src="${item.product.image_url}" class="h-full w-full object-contain filter drop-shadow-lg" onerror="this.src='https://placehold.co/150'">
                            </div>
                            
                            <div class="flex-1 min-w-0 mr-4">
                                <h3 class="text-xl md:text-3xl font-[1000] text-gray-900 leading-tight mb-2 truncate uppercase tracking-tight">${item.product.name}</h3>
                                <div class="bg-orange-50 inline-block px-4 py-1.5 rounded-xl border border-orange-100">
                                    <p class="text-lg md:text-2xl font-black text-orange-500 tracking-tighter">Bs. ${(item.product.price * item.quantity).toFixed(2)}</p>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-3 bg-gray-100 rounded-[1.5rem] p-2 md:p-3 shadow-inner">
                                <button onclick="kioskUpdateQty(${item.product.id}, -1)" class="w-10 h-10 md:w-14 md:h-14 bg-white rounded-2xl shadow-sm text-gray-400 hover:text-red-500 text-2xl md:text-3xl font-black transition active:scale-90 flex items-center justify-center">-</button>
                                <span class="text-xl md:text-3xl font-[1000] w-8 md:w-12 text-center text-gray-900">${item.quantity}</span>
                                <button onclick="kioskUpdateQty(${item.product.id}, 1)" class="w-10 h-10 md:w-14 md:h-14 bg-gray-900 text-white rounded-2xl shadow-xl hover:bg-black text-2xl md:text-3xl font-black transition active:scale-90 flex items-center justify-center">+</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Summary Card -->
                <div class="lg:w-[450px] flex-shrink-0">
                    <div class="bg-white rounded-[3.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.05)] p-8 md:p-12 sticky top-36 border border-gray-100 relative overflow-hidden">
                         <div class="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl opacity-50"></div>
                         
                         <h3 class="text-2xl md:text-3xl font-[1000] text-gray-900 mb-8 md:mb-12 uppercase text-center tracking-tighter border-b border-gray-100 pb-6 relative z-10">Opciones de Entrega</h3>
                         
                         <div class="grid grid-cols-2 gap-4 md:gap-6 mb-10 md:mb-14 relative z-10">
                            <button onclick="setDiningOption('eat-in')" class="p-6 md:p-10 rounded-[2.5rem] border-2 transition-all duration-300 flex flex-col items-center gap-4 ${kioskState.diningOption === 'eat-in' ? 'border-primary bg-primary/5 text-primary shadow-xl scale-105' : 'border-gray-50 bg-gray-50 text-gray-300 hover:bg-gray-100'}">
                                 <span class="text-5xl md:text-7xl drop-shadow-xl animate-float">🍽️</span>
                                 <span class="font-black text-xs md:text-base uppercase tracking-[0.2em] mt-2 text-center leading-none">En Mesa</span>
                            </button>
                            <button onclick="setDiningOption('takeout')" class="p-6 md:p-10 rounded-[2.5rem] border-2 transition-all duration-300 flex flex-col items-center gap-4 ${kioskState.diningOption === 'takeout' ? 'border-primary bg-primary/5 text-primary shadow-xl scale-105' : 'border-gray-50 bg-gray-50 text-gray-300 hover:bg-gray-100'}">
                                 <span class="text-5xl md:text-7xl drop-shadow-xl animate-float">🛍️</span>
                                 <span class="font-black text-xs md:text-base uppercase tracking-[0.2em] mt-2 text-center leading-none">Para Llevar</span>
                            </button>
                         </div>
                         
                         <div class="space-y-4 mb-10 md:mb-14 relative z-10 transition-all">
                            <div class="flex items-center justify-between p-4 md:p-6 bg-gray-50 rounded-[2.5rem] border border-gray-100 shadow-inner">
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 md:w-14 md:h-14 bg-white rounded-2xl flex items-center justify-center text-xl md:text-2xl shadow-sm border border-gray-100">🕒</div>
                                    <div>
                                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">PROGRAMAR PEDIDO</p>
                                        <p class="text-sm md:text-lg font-black text-gray-800 uppercase tracking-tighter">¿Reservar para más tarde?</p>
                                    </div>
                                </div>
                                <button onclick="toggleKioskReservation()" class="relative inline-flex h-8 w-14 md:h-10 md:w-20 items-center rounded-full transition-all focus:outline-none ${kioskState.isReservation ? 'bg-primary ring-4 ring-primary/20 scale-105' : 'bg-gray-200'}">
                                    <span class="inline-block h-6 w-6 md:h-8 md:w-8 transform rounded-full bg-white shadow-md transition-transform ${kioskState.isReservation ? 'translate-x-[24px] md:translate-x-[40px]' : 'translate-x-[4px]'}"></span>
                                </button>
                            </div>

                            ${kioskState.isReservation ? `
                                <div class="animate-slide-in-bottom p-5 md:p-8 bg-black text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                                    <div class="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-50"></div>
                                    <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div class="text-center md:text-left">
                                            <p class="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2 leading-none">Hora de Entrega</p>
                                            <p class="text-xs text-gray-400 font-bold max-w-[200px] leading-tight">Preparamos tu orden para la hora que elijas.</p>
                                        </div>
                                        <input type="time" id="reservation-time" 
                                               value="${kioskState.reservationTime || ''}"
                                               onchange="updateKioskReservationTime(this.value)"
                                               class="w-full md:w-48 p-4 md:p-6 rounded-[1.8rem] bg-white/10 text-white border border-white/10 font-black text-2xl md:text-4xl text-center focus:ring-4 focus:ring-primary/40 outline-none transition-all cursor-pointer hover:bg-white/20">
                                    </div>
                                </div>
                            ` : ''}
                         </div>

                         <div class="space-y-6 mb-10 md:mb-14 relative z-10">
                             <div class="bg-gray-900 text-white p-6 md:p-8 rounded-[2rem] shadow-2xl flex items-center justify-between group overflow-hidden relative">
                                 <div class="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                 <div class="relative z-10">
                                    <p class="text-[9px] font-black text-primary uppercase tracking-[0.4em] mb-1">Cliente</p>
                                    <p class="text-xl md:text-3xl font-[1000] capitalize tracking-tighter leading-none">${(store.user?.full_name || 'Invitado').split(' ')[0]}</p>
                                 </div>
                                 <div class="w-14 h-14 md:w-16 md:h-16 bg-white/10 rounded-2xl flex items-center justify-center shadow-inner overflow-hidden relative z-10 backdrop-blur-sm border border-white/5">
                                    ${store.user?.user_metadata?.avatar_url ? `<img src="${store.user.user_metadata.avatar_url}" class="w-full h-full object-cover">` : '<span class="text-2xl md:text-3xl">👤</span>'}
                                 </div>
                             </div>
                             
                             <div class="flex justify-between items-baseline px-4 text-gray-400 font-black text-lg md:text-2xl uppercase tracking-tighter">
                                <span>Subtotal</span>
                                <span>Bs. ${total.toFixed(2)}</span>
                             </div>
                             <div class="flex justify-between items-baseline px-4 text-4xl md:text-6xl font-[1000] text-gray-900 py-6 border-t border-gray-100 leading-none tracking-tighter">
                                <span>Total</span>
                                <span class="text-primary">Bs. ${total.toFixed(2)}</span>
                             </div>
                         </div>
                         
                         <button onclick="kioskCheckout()" class="w-full bg-primary hover:bg-orange-600 text-white font-[1000] text-2xl md:text-4xl py-6 md:py-8 rounded-[2.2rem] md:rounded-[2.8rem] shadow-[0_20px_50px_rgba(255,68,0,0.35)] transform transition-all duration-300 hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-4 group relative overflow-hidden">
                            <div class="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                            <span class="relative z-10">RESERVAR</span>
                            <div class="w-10 h-10 md:w-14 md:h-14 bg-white/20 rounded-full flex items-center justify-center text-lg md:text-2xl relative z-10">➔</div>
                         </button>
                    </div>
                </div>
            </div>
         </main>
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

/**
 * Success Screen
 */
function renderSuccessScreen(container) {
    const isReady = kioskState.orderStatus === 'completed';

    container.innerHTML = `
      <div class="h-full w-full flex flex-col items-center justify-center ${isReady ? 'bg-gradient-to-br from-blue-500 to-blue-700' : 'bg-gradient-to-br from-green-500 to-green-700'} text-white p-4 md:p-8 text-center animate-fade-in relative overflow-hidden">
         <div class="absolute top-0 left-0 w-48 h-48 md:w-64 md:h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
         <div class="absolute bottom-0 right-0 w-64 h-64 md:w-96 md:h-96 bg-black/10 rounded-full translate-x-1/3 translate-y-1/3 rotate-45"></div>

         <div class="z-10 animate-bounce-in-up w-full max-w-sm md:max-w-2xl px-2">
             <div class="bg-white ${isReady ? 'text-blue-600' : 'text-green-600'} rounded-full w-20 h-20 md:w-32 md:h-32 flex items-center justify-center text-4xl md:text-6xl shadow-2xl mb-6 md:mb-8 mx-auto animate-pulse">
                ${isReady ? '🍔' : '✓'}
             </div>
             
             <h1 class="text-4xl md:text-7xl font-[1000] mb-3 md:mb-4 tracking-tighter uppercase drop-shadow-lg leading-none">
                ${isReady ? '¡TU PEDIDO ESTÁ LISTO!' : '¡PEDIDO RECIBIDO!'}
             </h1>
             <p class="text-lg md:text-3xl font-medium opacity-90 mb-8 md:mb-12">
                ${isReady ? 'Por favor, pasa a recoger tu orden por el mostrador.' : 'Dirígete a caja e indica tu número de pedido'}
             </p>
             
             <div class="bg-white text-gray-800 rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 shadow-2xl transform -rotate-1 border-t-8 ${isReady ? 'border-blue-400' : 'border-yellow-400'} relative">
                <div class="absolute -top-4 md:-top-6 left-1/2 -translate-x-1/2 ${isReady ? 'bg-blue-400' : 'bg-yellow-400'} text-black px-4 md:px-6 py-1.5 md:py-2 rounded-full font-black text-xs md:text-sm tracking-widest uppercase shadow-md whitespace-nowrap">
                    Tu Número de Orden
                </div>
                <p class="text-7xl md:text-9xl font-[1000] tracking-tighter text-gray-900 mb-1">
                    #${String(kioskState.lastOrderId).slice(-3)}
                </p>
                <div class="w-full h-1 bg-gray-100 my-4 md:my-6"></div>
                <p class="text-base md:text-xl font-bold text-gray-400 uppercase tracking-widest">Estado: <span class="${isReady ? 'text-blue-600' : 'text-green-600'}">${isReady ? 'LISTO PARA RECOGER' : 'EN PREPARACIÓN'}</span></p>
             </div>
             
             <div class="mt-8 md:mt-16">
                 <button onclick="kioskFinish()" class="bg-white ${isReady ? 'text-blue-700' : 'text-green-700'} font-black px-10 py-5 md:px-16 md:py-6 rounded-full shadow-xl text-lg md:text-2xl hover:bg-gray-50 transition transform hover:scale-105 active:scale-95 uppercase tracking-tight">
                    Nuevo Pedido
                 </button>
             </div>
         </div>
      </div>
    `;

    window.kioskFinish = () => {
        store.clearCart();
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
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    const customerName = store.user?.full_name || store.customerName || 'Cliente';
    const { error } = await supabase.from('order_messages').insert({
        order_id: kioskState.lastOrderId, 
        sender_name: customerName,
        message: msg
    });

    if (!error) {
        input.value = '';
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
