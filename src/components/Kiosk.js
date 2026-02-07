import { store } from '../store.js';
import { supabase } from '../services/supabase.js';

import { generateReceiptHTML, printTicket } from '../utils/printer.js';

// Estado interno del Kiosco
let kioskState = {
    screen: 'menu', // menu, cart, success
    diningOption: 'eat-in', // eat-in, takeout
    lastOrderId: null,
    activeCategory: 'Todos',
    modalProduct: null // Product Object if modal is open
};

// Cache for Kiosk Data
let kioskCache = {
    products: null,
    categories: null
};

// Track previous state to avoid full re-renders
let lastRenderedScreen = null;

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

    // Toast Container
    if (!document.getElementById('kiosk-toast-container')) {
        const toastC = document.createElement('div');
        toastC.id = 'kiosk-toast-container';
        toastC.className = 'absolute top-24 right-8 z-50 flex flex-col gap-2 pointer-events-none';
        container.appendChild(toastC);
    }
}

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

    // Default categories if DB is empty, plus icons mapping
    const allCategories = ['Todos', ...dbCategories];

    const cartQty = store.cart.reduce((acc, item) => acc + item.quantity, 0);

    // Helper for icons (McDonald's style often uses specific vector art, we'll use emoji/svg representation for now)
    const getCatIcon = (c) => {
        const lower = c.toLowerCase();
        if (lower.includes('hamburguesa')) return '🍔';
        if (lower.includes('pollo')) return '🍗';
        if (lower.includes('bebida')) return '🥤';
        if (lower.includes('postre') || lower.includes('helado')) return '🍦';
        if (lower.includes('combo')) return '🥡';
        if (lower.includes('papas') || lower.includes('acompañante')) return '🍟';
        if (lower.includes('café') || lower.includes('cafe')) return '☕';
        return '🍴';
    };

    // Filter
    const filteredProducts = kioskState.activeCategory === 'Todos'
        ? products
        : products.filter(p => (p.category || 'General') === kioskState.activeCategory);

    container.innerHTML = `
    <div class="h-full flex bg-[#f4f4f4] font-sans">
        <!-- Sidebar Navigation (Left) -->
        <aside class="w-24 md:w-40 lg:w-48 flex-shrink-0 bg-white shadow-xl z-20 flex flex-col items-center py-6 md:py-8 overflow-y-auto hide-scrollbar border-r border-gray-200">
            <div class="mb-6 md:mb-10" onclick="setKioskScreen('welcome')">
                 <img src="/logo.png" 
                      class="w-16 h-16 object-contain md:w-28 md:h-28 filter drop-shadow hover:scale-110 transition cursor-pointer" 
                      onerror="this.src='https://placehold.co/150x150?text=HEHA'">
            </div>
            
            <nav class="flex flex-col gap-6 w-full px-2">
                ${allCategories.map(cat => `
                    <button onclick="kioskSetCategory('${cat}')" 
                           class="flex flex-col items-center p-3 rounded-2xl transition-all duration-300 group
                           ${kioskState.activeCategory === cat ? 'bg-black text-white shadow-lg scale-105' : 'text-gray-400 hover:text-gray-800 hover:bg-gray-50'}">
                        <div class="text-4xl mb-2 transition-transform duration-300 group-hover:scale-110 ${kioskState.activeCategory === cat ? 'filter brightness-150' : 'filter grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100'}">
                            ${getCatIcon(cat)}
                        </div>
                        <span class="text-xs font-black uppercase tracking-wider text-center leading-tight">${cat}</span>
                    </button>
                `).join('')}
            </nav>
        </aside>

        <!-- Main Content (Right) -->
        <main class="flex-1 flex flex-col h-full relative overflow-hidden">
            <!-- Header -->
            <header class="flex-shrink-0 px-4 md:px-8 py-4 md:py-6 flex justify-between items-center md:items-end bg-gradient-to-b from-[#f4f4f4] to-[#f4f4f4]/90 z-10 sticky top-0">
                <div class="flex-1 min-w-0 pr-4">
                   <h1 class="text-3xl md:text-5xl font-black text-gray-800 tracking-tight uppercase truncate">${kioskState.activeCategory}</h1>
                   <p class="text-gray-500 font-bold mt-0.5 md:mt-1 text-sm md:text-lg truncate">Explora nuestros deliciosos productos</p>
                </div>
                
                <button onclick="setKioskScreen('welcome')" class="bg-[#333] text-white font-bold py-2 md:py-3 px-4 md:px-8 rounded-full shadow-lg hover:bg-black transition transform hover:-translate-y-1 text-xs md:text-base flex-shrink-0">
                    CANCELAR
                </button>
            </header>

            <!-- Product Grid -->
            <div class="flex-1 overflow-y-auto px-4 md:px-8 pb-32 animate-fade-in custom-scrollbar">
                 ${filteredProducts.length === 0 ? `
                    <div class="h-64 flex flex-col items-center justify-center text-gray-400">
                        <span class="text-6xl mb-4">😢</span>
                        <p class="text-2xl font-bold">Sin productos aquí</p>
                    </div>
                 ` : ''}
                 
                 <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-8 gap-y-12 pt-4">
                    ${filteredProducts.map(p => `
                        <div class="bg-white rounded-[2rem] p-6 shadow-sm hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer relative group border border-transparent hover:border-gray-100" onclick="kioskOpenModal(${p.id})">
                             <!-- Image floating out of card effect -->
                             <div class="h-48 -mt-12 mb-4 relative flex items-center justify-center filter drop-shadow-xl group-hover:drop-shadow-2xl transition-all duration-500">
                                 <img src="${p.image_url}" class="max-h-full max-w-full object-contain transform group-hover:scale-110 transition-transform duration-500" onerror="this.src='https://placehold.co/300x300?text=Comida'">
                                 ${p.price < 20 ? '<div class="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">OFERTA</div>' : ''}
                             </div>
                             
                             <div class="text-center">
                                 <h3 class="font-black text-xl text-gray-800 leading-tight mb-2 line-clamp-2 min-h-[3.5rem] flex items-center justify-center">${p.name}</h3>
                                 <div class="text-3xl font-black text-yellow-500 drop-shadow-sm mb-4">
                                    <span class="text-lg text-gray-400 align-top font-bold mr-1">Bs.</span>${Math.floor(p.price)}<span class="text-lg align-top ml-1">${(p.price % 1).toFixed(2).substring(1)}</span>
                                 </div>
                                 
                                 <button class="w-full bg-[#f4f4f4] text-gray-800 font-bold py-3 rounded-xl group-hover:bg-yellow-400 group-hover:text-black transition-colors duration-300">
                                    Personalizar
                                 </button>
                             </div>
                        </div>
                    `).join('')}
                 </div>
            </div>
            
            <!-- Floating Cart Summary (Bottom Right) -->
            ${cartQty > 0 ? `
                <div class="absolute bottom-4 right-4 md:bottom-8 md:right-8 z-30 animate-bounce-in-up">
                    <button onclick="setKioskScreen('cart')" class="bg-green-600 text-white py-3 px-5 md:py-4 md:px-8 rounded-full shadow-2xl flex items-center gap-3 md:gap-6 hover:bg-green-500 transition transform hover:scale-105 active:scale-95 ring-4 ring-white">
                        <div class="flex flex-col items-start leading-tight">
                             <span class="text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-80">Tu Pedido</span>
                             <span class="text-xl md:text-2xl font-black">Bs. ${store.cartTotal.toFixed(2)}</span>
                        </div>
                        <div class="bg-white/20 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-black text-lg md:text-xl backdrop-blur-sm border border-white/10">
                            ${cartQty}
                        </div>
                    </button>
                </div>
            ` : ''}
        </main>
    </div>
    `;
    // Expose helpers globally or ensure they exist
    window.kioskSetCategory = (cat) => {
        kioskState.activeCategory = cat;
        // Force refresh only if category changes, or just re-render content area?
        // Simples: full re-render (which now uses cache and is fast)
        renderKiosk(container, true);
    };

    window.kioskOpenModal = (id) => {
        const products = kioskCache.products || [];
        const p = products.find(x => x.id === id);
        if (p) {
            kioskState.modalProduct = p;
            renderKiosk(container); // Smart render will just add overlay
        }
    };

    window.kioskCloseModal = () => {
        kioskState.modalProduct = null;
        renderKiosk(container); // Smart render will remove overlay
    };

    window.kioskConfirmAdd = (id) => {
        const products = kioskCache.products || [];
        const p = products.find(x => x.id === id);
        if (p) {
            // Get quantity from modal input 
            const qtyInput = document.getElementById('modal-qty');
            const qty = qtyInput ? parseInt(qtyInput.innerText) : 1;

            store.addToCart(p, qty);

            kioskState.modalProduct = null;
            renderKiosk(container, true);

            showKioskToast(`+${qty} ${p.name} agregado`);
        }
    };

    // Modal Render Logic (Inline for simplicity or separate function)
}

function renderProductModal(container) {
    const p = kioskState.modalProduct;
    if (!p) return;

    const modalHTML = `
      <div id="kiosk-modal-overlay" class="absolute inset-0 z-50 flex items-center justify-center p-4 animate-fade-in bg-black/70 backdrop-blur-md" onclick="if(event.target === this) kioskCloseModal()">
         <div class="bg-[#f4f4f4] w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh] animate-bounce-in-up border border-white/20">
            <div class="h-64 md:h-80 relative flex items-center justify-center p-6 md:p-8 bg-white/50">
               <img src="${p.image_url}" class="max-h-full max-w-full object-contain filter drop-shadow-2xl transform scale-110" onerror="this.src='https://placehold.co/400x400?text=Comida'">
               <button onclick="kioskCloseModal()" class="absolute top-4 right-4 md:top-6 md:right-6 bg-white p-3 md:p-4 rounded-full shadow-lg hover:scale-110 hover:bg-gray-100 transition text-gray-800 font-bold z-10 flex items-center justify-center w-10 h-10 md:w-12 md:h-12">
                 ✕
               </button>
            </div>
            
            <div class="p-6 md:p-10 flex-1 flex flex-col bg-white rounded-t-[3rem] -mt-10 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] relative z-0 overflow-y-auto">
               <div class="flex flex-col md:flex-row justify-between items-start mb-4 gap-2">
                  <h2 class="text-3xl md:text-5xl font-black text-gray-800 leading-tight uppercase tracking-tight">${p.name}</h2>
                  <span class="text-3xl md:text-5xl font-black text-yellow-500 whitespace-nowrap drop-shadow-sm">
                    <span class="text-xl md:text-2xl text-gray-400 font-bold mr-1">Bs.</span>${p.price}
                  </span>
               </div>
               
               <p class="text-gray-500 text-lg md:text-xl font-medium mb-6 md:mb-10 leading-relaxed">${p.description || 'Deliciosa opción preparada al momento con los mejores ingredientes.'}</p>
               
               <div class="bg-gray-50 rounded-3xl p-4 md:p-6 mt-auto">
                    <div class="flex flex-col sm:flex-row items-center justify-between gap-4 md:gap-6">
                        <div class="flex items-center bg-white rounded-2xl shadow-sm p-1.5 md:p-2 border border-gray-100 w-full sm:w-auto justify-center">
                             <button onclick="updateModalQty(-1)" class="w-12 h-12 md:w-16 md:h-16 bg-transparent text-gray-400 hover:text-red-500 rounded-xl text-3xl md:text-4xl font-black transition">-</button>
                             <span id="modal-qty" class="text-3xl md:text-4xl font-black w-12 md:w-16 text-center text-gray-800">1</span>
                             <button onclick="updateModalQty(1)" class="w-12 h-12 md:w-16 md:h-16 bg-transparent text-gray-400 hover:text-green-500 rounded-xl text-3xl md:text-4xl font-black transition">+</button>
                        </div>
                        
                        <button onclick="kioskConfirmAdd(${p.id})" class="w-full sm:flex-1 bg-black text-white font-black text-xl md:text-2xl py-5 md:py-6 rounded-2xl shadow-xl hover:bg-gray-900 transform active:scale-95 transition-all flex items-center justify-center gap-3">
                            <span>AGREGAR</span>
                            <span class="bg-white/20 px-3 py-1 rounded-lg text-lg">➔</span>
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

    // Local helper for modal
    window.updateModalQty = (delta) => {
        const el = document.getElementById('modal-qty');
        let v = parseInt(el.innerText) + delta;
        if (v < 1) v = 1;
        el.innerText = v;
    };
}

function showKioskToast(msg) {
    const container = document.getElementById('kiosk-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'bg-gray-800 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in transform translate-x-10 transition-all duration-300';
    toast.style.transform = 'translateX(0)';
    toast.innerHTML = `<span class="text-green-400 text-xl">✓</span> <span class="font-bold">${msg}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function renderCartScreen(container) {
    const total = store.cartTotal;

    container.innerHTML = `
      <div class="h-full flex flex-col bg-[#f4f4f4] font-sans">
         <header class="bg-white shadow-sm p-6 flex items-center gap-6 sticky top-0 z-20">
             <button onclick="setKioskScreen('menu')" class="p-4 rounded-full bg-gray-100 hover:bg-gray-200 transition transform hover:scale-105 shadow-sm">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             </button>
             <div>
                <h1 class="text-4xl font-black text-gray-800 uppercase tracking-tight">Tu Pedido</h1>
                <p class="text-gray-500 font-bold">Revisa antes de confirmar</p>
             </div>
         </header>
         
         <main class="flex-1 overflow-y-auto p-6 md:p-12 animate-fade-in custom-scrollbar">
            <div class="max-w-5xl mx-auto flex flex-col lg:flex-row gap-8">
            
                <!-- Items List -->
                <div class="flex-1 space-y-4">
                    ${store.cart.length === 0 ? `
                        <div class="bg-white rounded-[2rem] p-12 text-center shadow-sm">
                            <span class="text-6xl block mb-4">🛒</span>
                            <h3 class="text-2xl font-bold text-gray-400">Tu carrito está vacío</h3>
                            <button onclick="setKioskScreen('menu')" class="mt-6 text-primary font-black underline text-xl">Ir al Menú</button>
                        </div>
                    ` : store.cart.map(item => `
                        <div class="flex items-center bg-white p-3 md:p-4 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-transparent hover:border-gray-200 transition pr-4 md:pr-6">
                            <div class="h-20 w-20 md:h-28 md:w-28 rounded-xl md:rounded-2xl bg-gray-50 overflow-hidden flex-shrink-0 mr-4 md:mr-6 relative">
                                <img src="${item.product.image_url}" class="h-full w-full object-cover" onerror="this.src='https://placehold.co/100'">
                            </div>
                            
                            <div class="flex-1 min-w-0 mr-2 md:mr-4">
                                <h3 class="text-lg md:text-2xl font-black text-gray-800 leading-tight mb-0.5 md:mb-1 truncate">${item.product.name}</h3>
                                <p class="text-base md:text-xl font-bold text-yellow-500">Bs. ${(item.product.price * item.quantity).toFixed(2)}</p>
                            </div>
                            
                            <div class="flex items-center gap-1.5 md:gap-3 bg-gray-100 rounded-lg md:rounded-xl p-1 md:p-2">
                                <button onclick="kioskUpdateQty(${item.product.id}, -1)" class="w-8 h-8 md:w-10 md:h-10 bg-white rounded shadow-sm text-gray-600 hover:text-red-500 text-xl md:text-2xl font-black transition flex items-center justify-center">-</button>
                                <span class="text-base md:text-xl font-black w-6 md:w-8 text-center">${item.quantity}</span>
                                <button onclick="kioskUpdateQty(${item.product.id}, 1)" class="w-8 h-8 md:w-10 md:h-10 bg-black text-white rounded shadow-sm hover:bg-gray-800 text-xl md:text-2xl font-black transition flex items-center justify-center">+</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Summary Card -->
                <div class="lg:w-96 flex-shrink-0">
                    <div class="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-xl p-6 md:p-8 sticky top-24 border border-gray-100">
                         <h3 class="text-xl md:text-2xl font-black text-gray-800 mb-6 md:mb-8 uppercase text-center">Entrega</h3>
                         
                         <div class="grid grid-cols-2 gap-3 md:gap-4 mb-8 md:mb-10">
                            <button onclick="setDiningOption('eat-in')" class="p-4 md:p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-2 md:gap-3 ${kioskState.diningOption === 'eat-in' ? 'border-yellow-400 bg-yellow-50 text-black shadow-lg scale-105' : 'border-gray-100 bg-gray-50 text-gray-400 hover:bg-gray-100'}">
                                 <span class="text-4xl md:text-5xl drop-shadow-sm">🍽️</span>
                                 <span class="font-black text-[10px] md:text-sm uppercase tracking-wide">Mesa</span>
                            </button>
                            <button onclick="setDiningOption('takeout')" class="p-4 md:p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-2 md:gap-3 ${kioskState.diningOption === 'takeout' ? 'border-yellow-400 bg-yellow-50 text-black shadow-lg scale-105' : 'border-gray-100 bg-gray-50 text-gray-400 hover:bg-gray-100'}">
                                 <span class="text-4xl md:text-5xl drop-shadow-sm">🛍️</span>
                                 <span class="font-black text-[10px] md:text-sm uppercase tracking-wide">Llevar</span>
                            </button>
                         </div>
                         
                         <div class="space-y-4 mb-8">
                             <div>
                                <label class="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Tu Nombre para el Pedido</label>
                                <input type="text" id="kiosk-customer-name" 
                                       placeholder="Escribe tu nombre aquí..." value="${store.customerName || ''}"
                                       class="w-full p-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-yellow-400 outline-none text-xl font-bold transition-all">
                             </div>
                             
                             <div class="flex justify-between text-gray-500 font-bold text-lg">
                                <span>Subtotal</span>
                                <span>Bs. ${total.toFixed(2)}</span>
                             </div>
                             <div class="flex justify-between text-4xl font-black text-gray-800 pt-4 border-t border-gray-100">
                                <span>Total</span>
                                <span class="text-yellow-500">Bs. ${total.toFixed(2)}</span>
                             </div>
                         </div>
                         
                         <button onclick="kioskCheckout()" class="w-full bg-black hover:bg-gray-900 text-white font-black text-2xl py-6 rounded-2xl shadow-xl transform transition hover:scale-105 active:scale-95 flex items-center justify-center gap-3 group">
                            <span>PAGAR AHORA</span>
                            <span class="group-hover:translate-x-2 transition-transform">➔</span>
                         </button>
                         
                         <p class="text-center text-gray-300 text-xs font-bold mt-4 uppercase tracking-widest">Pago en caja</p>
                    </div>
                </div>
            </div>
         </main>
      </div>
    `;

    window.kioskUpdateQty = (id, delta) => {
        store.updateCartQuantity(id, delta);
        renderKiosk(container);
    };

    window.setDiningOption = (opt) => {
        kioskState.diningOption = opt;
        renderKiosk(container);
    };

    window.kioskCheckout = async () => {
        if (store.cart.length === 0) return;

        const nameInput = document.getElementById('kiosk-customer-name');
        const customerName = nameInput ? nameInput.value.trim() : '';

        if (!customerName) {
            alert("Por favor, ingresa tu nombre para que podamos llamarte.");
            nameInput.focus();
            return;
        }

        // Create Order - status PENDING for kiosk
        const orderData = {
            total_amount: store.cartTotal,
            order_type: kioskState.diningOption === 'eat-in' ? 'mesa' : 'llevar',
            status: 'pending', // Pending payment at cashier
            payment_method: 'pendiente',
            customer_name: customerName,
            created_at: new Date(),
            cashier_name: 'Kiosco'
        };

        const { data, error } = await supabase.from('orders').insert(orderData).select().single();

        if (data) {
            // Save Items
            const items = store.cart.map(item => ({
                order_id: data.id,
                product_id: item.product.id,
                quantity: item.quantity,
                price_at_sale: item.product.price
            }));
            await supabase.from('order_items').insert(items);

            kioskState.lastOrderId = data.id;

            setKioskScreen('success');
        } else {
            alert("Error al procesar: " + error.message);
        }
    };
}

function renderSuccessScreen(container) {
    // Auto-reset timer
    setTimeout(() => {
        if (kioskState.screen === 'success') {
            store.clearCart();
            setKioskScreen('menu');
        }
    }, 20000);

    container.innerHTML = `
      <div class="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-green-500 to-green-700 text-white p-4 md:p-8 text-center animate-fade-in relative overflow-hidden">
         <!-- Decorative Background Elements -->
         <div class="absolute top-0 left-0 w-48 h-48 md:w-64 md:h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
         <div class="absolute bottom-0 right-0 w-64 h-64 md:w-96 md:h-96 bg-black/10 rounded-full translate-x-1/3 translate-y-1/3 rotate-45"></div>

         <div class="z-10 animate-bounce-in-up w-full max-w-sm md:max-w-2xl px-2">
             <div class="bg-white text-green-600 rounded-full w-20 h-20 md:w-32 md:h-32 flex items-center justify-center text-4xl md:text-6xl shadow-2xl mb-6 md:mb-8 mx-auto animate-pulse">
                ✓
             </div>
             
             <h1 class="text-4xl md:text-7xl font-[1000] mb-3 md:mb-4 tracking-tighter uppercase drop-shadow-lg leading-none">¡Pedido<br class="md:hidden"> Recibido!</h1>
             <p class="text-lg md:text-3xl font-medium opacity-90 mb-8 md:mb-12">Dirígete a caja e indica tu <br class="hidden md:block"> número de pedido</p>
             
             <div class="bg-white text-gray-800 rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 shadow-2xl transform -rotate-1 border-t-8 border-yellow-400 relative">
                <div class="absolute -top-4 md:-top-6 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-4 md:px-6 py-1.5 md:py-2 rounded-full font-black text-xs md:text-sm tracking-widest uppercase shadow-md whitespace-nowrap">
                    Tu Número de Orden
                </div>
                <p class="text-7xl md:text-9xl font-[1000] tracking-tighter text-gray-900 mb-1">
                    #${String(kioskState.lastOrderId).slice(-3)}
                </p>
                <div class="w-full h-1 bg-gray-100 my-4 md:my-6"></div>
                <p class="text-base md:text-xl font-bold text-gray-400 uppercase tracking-widest">Total: Bs. ${store.cartTotal.toFixed(2)}</p>
             </div>
             
             <div class="mt-8 md:mt-16 flex flex-col items-center gap-4">
                 <button onclick="kioskFinish()" class="bg-white text-green-700 font-black px-10 py-5 md:px-16 md:py-6 rounded-full shadow-xl text-lg md:text-2xl hover:bg-gray-50 transition transform hover:scale-105 active:scale-95 uppercase tracking-tight">
                    Nuevo Pedido
                 </button>
             </div>
             
             <p class="mt-6 md:mt-8 text-[9px] md:text-sm opacity-50 font-bold uppercase tracking-widest">Se reinicia en 20s</p>
         </div>
      </div>
    `;

    window.kioskFinish = () => {
        store.clearCart();
        setKioskScreen('menu');
    };
}

// Helper to switch screens within Kiosk
window.setKioskScreen = (screen) => {
    kioskState.screen = screen;
    // In Kiosk mode, we render directly to #app (passed as container initially)
    // We try to find app again.
    const container = document.getElementById('app');
    if (container) renderKiosk(container);
}
