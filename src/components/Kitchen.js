import { supabase } from '../services/supabase.js';
import { store } from '../store.js';

export async function renderKitchenView(container) {
    container.innerHTML = `
        <div class="space-y-8 animate-fade-in pb-20">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                   <h2 class="text-4xl font-black text-gray-800 tracking-tight">Comandas de Cocina</h2>
                   <p class="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Pedidos en preparación en tiempo real</p>
                </div>
                <div class="flex gap-3">
                    <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                        <span class="relative flex h-3 w-3">
                          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span class="text-[10px] font-black uppercase text-gray-500 tracking-widest">En Vivo</span>
                    </div>
                </div>
            </div>

            <div id="kitchen-orders-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <!-- Comandas result here -->
                <div class="col-span-full py-32 flex flex-col items-center justify-center text-gray-300">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                    <p class="font-black uppercase tracking-widest text-xs">Cargando fuegos...</p>
                </div>
            </div>
        </div>
    `;

    loadKitchenOrders();
    setupKitchenRealtime();
}

let kitchenSubscription = null;

async function loadKitchenOrders() {
    const grid = document.getElementById('kitchen-orders-grid');

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(*))')
        .eq('kitchen_status', 'pending')
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error loading kitchen orders:', error);
        if (grid) {
            grid.innerHTML = `
                <div class="col-span-full p-8 bg-red-50 text-red-600 rounded-3xl border border-red-100 flex flex-col items-center">
                    <p class="font-black uppercase tracking-widest text-sm mb-2">Error de Conexión</p>
                    <p class="text-xs opacity-80">${error.message}</p>
                    <p class="text-xs mt-4 font-bold">Asegúrate de haber ejecutado el archivo SQL sugerido.</p>
                </div>
            `;
        }
        return;
    }

    renderKitchenGrid(orders || []);
}

function renderKitchenGrid(orders) {
    const grid = document.getElementById('kitchen-orders-grid');
    if (!grid) return;

    if (orders.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-32 flex flex-col items-center justify-center text-gray-300 bg-white rounded-[3rem] border border-gray-100 shadow-sm animate-fade-in">
                <div class="bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mb-6">
                    <span class="text-6xl">👨‍🍳</span>
                </div>
                <p class="text-2xl font-black text-gray-800 tracking-tight">Cocina Despejada</p>
                <p class="font-bold text-xs uppercase tracking-widest text-gray-400 mt-2">No hay pedidos pendientes en este momento</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = orders.map(order => {
        const time = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const elapsed = Math.floor((new Date() - new Date(order.created_at)) / 60000);

        let timeColor = 'text-gray-400';
        if (elapsed > 15) timeColor = 'text-red-500 animate-pulse';
        else if (elapsed > 10) timeColor = 'text-orange-500';

        const itemsHtml = order.order_items.map(item => `
            <div class="flex justify-between items-start py-3 border-b border-dashed border-gray-100 last:border-0">
                <div class="flex gap-3">
                    <span class="w-7 h-7 bg-black text-white rounded-lg flex items-center justify-center text-xs font-black shrink-0">${item.quantity}</span>
                    <div>
                        <p class="text-sm font-black text-gray-800 capitalize leading-tight">${(item.products?.name || 'Producto').toLowerCase()}</p>
                        <p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest">${item.products?.category || 'General'}</p>
                    </div>
                </div>
            </div>
        `).join('');

        return `
            <div class="bg-white rounded-[2rem] shadow-sm border-2 border-transparent hover:border-primary/20 transition-all duration-300 flex flex-col overflow-hidden animate-fade-in-up">
                <div class="p-6 border-b border-gray-50 bg-gray-50/30">
                    <div class="flex justify-between items-start mb-3">
                        <span class="px-2 py-1 bg-black text-white text-[9px] font-black rounded-lg">#${String(order.id).slice(-4)}</span>
                        <div class="text-right">
                             <p class="text-[9px] font-black uppercase tracking-widest ${timeColor}"> hace ${elapsed} min</p>
                        </div>
                    </div>
                    <h3 class="text-xl font-black text-gray-800 truncate capitalize">${(order.customer_name || 'Cliente').toLowerCase()}</h3>
                    <div class="flex items-center gap-2 mt-2">
                        <span class="px-2 py-0.5 bg-gray-100 text-gray-500 text-[8px] font-black rounded uppercase tracking-widest">
                            ${order.order_type === 'mesa' ? '🍴 Local' : (order.order_type === 'whatsapp' ? '🚚 Envío' : '🥡 Llevar')}
                        </span>
                    </div>
                </div>

                <div class="p-6 flex-1 max-h-64 overflow-y-auto scrollbar-hide">
                    ${itemsHtml}
                </div>

                <div class="p-4 bg-white border-t border-gray-50">
                    <button onclick="window.markOrderReady('${order.id}')" 
                            class="w-full bg-green-500 hover:bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-green-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-tighter text-sm">
                        <span>✅</span> LISTO PARA ENTREGAR
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Global Actions
window.markOrderReady = async (orderId) => {
    const { error } = await supabase
        .from('orders')
        .update({ kitchen_status: 'ready' })
        .eq('id', orderId);

    if (error) {
        alert('Error al actualizar estado: ' + error.message);
    } else {
        // Optimistic UI update via realtime or manual reload
        loadKitchenOrders();
    }
};

// Setup Kitchen Realtime
function setupKitchenRealtime() {
    if (kitchenSubscription) return;

    kitchenSubscription = supabase
        .channel('kitchen-realtime')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'orders', filter: 'status=eq.completed' },
            (payload) => {
                if (window.playNotificationSound) window.playNotificationSound();
                loadKitchenOrders();
                showToast('👨‍🍳 ¡Nuevo pedido para cocina!', 'success');
            }
        )
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'orders' },
            (payload) => {
                // If kitchen_status changed to pending (shouldn't happen often but for safety)
                loadKitchenOrders();
            }
        )
        .subscribe();
}
