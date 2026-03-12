import { supabase } from '../services/supabase.js';

export async function renderInventoryView(container) {
    // 1. Fetch products with stock tracking
    const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('track_stock', true)
        .order('stock', { ascending: true });

    const categories = ['Todos', ...new Set(products ? products.map(p => p.category || 'General') : [])];

    container.innerHTML = `
        <div class="space-y-10 animate-fade-in pb-20">
            <!-- Header Section -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 class="text-4xl font-black text-gray-800 tracking-tight">Inventario de Stock</h2>
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Controla productos con límite de existencia</p>
                </div>
                <div class="flex gap-4 w-full md:w-auto">
                    <button id="btn-refresh-inv" class="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition active:scale-95">
                        🔄
                    </button>
                    <div class="relative flex-1 md:w-64">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input type="text" id="inv-search" placeholder="Buscar producto..." class="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-gray-100 shadow-sm focus:ring-2 focus:ring-black/5 outline-none font-medium">
                    </div>
                </div>
            </div>

            <!-- Stats Overview -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 border-l-8 border-l-red-500">
                    <p class="text-[10px] font-black text-gray-400 uppercase mb-1">Stock Crítico</p>
                    <p class="text-3xl font-black text-gray-800">${products ? products.filter(p => p.stock <= 5).length : 0}</p>
                </div>
                <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 border-l-8 border-l-orange-500">
                    <p class="text-[10px] font-black text-gray-400 uppercase mb-1">Bajo en Existencia</p>
                    <p class="text-3xl font-black text-gray-800">${products ? products.filter(p => p.stock > 5 && p.stock <= 15).length : 0}</p>
                </div>
                 <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 border-l-8 border-l-green-500">
                    <p class="text-[10px] font-black text-gray-400 uppercase mb-1">Total Productos</p>
                    <p class="text-3xl font-black text-gray-800">${products ? products.length : 0}</p>
                </div>
            </div>

            <!-- Inventory Table -->
            <div class="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
                <div class="overflow-x-auto scrollbar-hide">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-gray-50/50">
                                <th class="py-6 px-10 text-[10px] font-black text-gray-400 uppercase tracking-widest">Producto</th>
                                <th class="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Categoría</th>
                                <th class="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Existencia</th>
                                <th class="py-6 px-10 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones de Reposición</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50" id="inv-table-body">
                            ${products && products.length > 0 ? products.map(p => `
                                <tr class="group hover:bg-gray-50/50 transition-colors">
                                    <td class="py-6 px-10">
                                        <div class="flex items-center gap-6">
                                            <div class="h-16 w-16 rounded-2xl bg-gray-50 overflow-hidden flex-shrink-0 shadow-sm border border-gray-100">
                                                <img src="${p.image_url}" class="h-full w-full object-cover">
                                            </div>
                                            <div>
                                                <p class="font-black text-gray-800 text-lg capitalize leading-tight">${p.name.toLowerCase()}</p>
                                                <p class="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">ID: #${p.id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="py-6 px-4">
                                        <span class="bg-gray-50 text-gray-500 text-[9px] font-black px-3 py-1.5 rounded-xl border border-gray-100 uppercase tracking-widest">${p.category || 'General'}</span>
                                    </td>
                                    <td class="py-6 px-4 text-right">
                                        <div class="flex flex-col items-end">
                                            <p class="text-2xl font-black ${p.stock <= 5 ? 'text-red-500 animate-pulse' : (p.stock <= 15 ? 'text-orange-500' : 'text-gray-800')} tabular-nums">
                                                ${p.stock}
                                            </p>
                                            <span class="text-[9px] font-black text-gray-300 uppercase tracking-tighter">UNIDADES</span>
                                        </div>
                                    </td>
                                    <td class="py-6 px-10 text-right">
                                        <div class="flex justify-end gap-2">
                                            <button onclick="window.openWithdrawModal(${p.id})" class="px-4 py-2 bg-red-50 text-red-500 font-black text-[10px] rounded-xl hover:bg-red-500 hover:text-white transition uppercase tracking-widest active:scale-95 shadow-sm border border-red-100">Salida</button>
                                            <button onclick="window.openRefillModal(${p.id})" class="px-4 py-2 bg-black text-white font-black text-[10px] rounded-xl hover:scale-105 transition uppercase tracking-widest active:scale-95 shadow-lg shadow-black/10">Reponer</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="4" class="py-40 text-center text-gray-300 font-black uppercase tracking-widest text-xs">No hay productos con stock habilitado</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Listeners
    document.getElementById('btn-refresh-inv').addEventListener('click', () => renderInventoryView(container));

    document.getElementById('inv-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#inv-table-body tr');
        rows.forEach(row => {
            const name = row.querySelector('p.font-black')?.innerText.toLowerCase() || '';
            row.classList.toggle('hidden', !name.includes(query));
        });
    });

    // Global Actions
    window.quickRefill = async (id, amount) => {
        const { data: p } = await supabase.from('products').select('stock').eq('id', id).single();
        if (!p) return;

        const { error } = await supabase
            .from('products')
            .update({ stock: (p.stock || 0) + amount })
            .eq('id', id);

        if (error) showToast('Error al actualizar stock', 'error');
        else {
            showToast(`✅ Stock actualizado (+${amount} unidades)`);
            renderInventoryView(container);
        }
    };

    window.openRefillModal = async (id) => {
        const { data: p } = await supabase.from('products').select('*').eq('id', id).single();
        if (!p) return;

        const modalHTML = `
            <div id="refill-modal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in text-gray-800">
                <div class="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl animate-bounce-slow text-center">
                    <div class="w-16 h-16 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">📈</div>
                    <h3 class="text-2xl font-black tracking-tight capitalize mb-1">Reponer: ${p.name.toLowerCase()}</h3>
                    <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest">Añadir existencias al inventario</p>
                    
                    <div class="my-8">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Unidades a añadir</p>
                        <input type="number" id="refill-qty" value="10" min="1" class="w-full text-center text-5xl font-black p-4 bg-gray-50 rounded-3xl border-2 border-transparent focus:border-green-500 focus:bg-white outline-none transition-all text-green-600">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Stock actual: ${p.stock}</p>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <button onclick="document.getElementById('refill-modal').remove()" class="py-4 rounded-2xl font-black text-gray-400 hover:bg-gray-100 transition uppercase tracking-widest text-[10px]">Cancelar</button>
                        <button id="btn-confirm-refill" class="py-4 bg-black text-white rounded-2xl font-black shadow-lg shadow-black/20 transition active:scale-95 uppercase tracking-widest text-[10px]">Confirmar Ingreso</button>
                    </div>
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = modalHTML;
        document.body.appendChild(div.firstElementChild);

        document.getElementById('btn-confirm-refill').addEventListener('click', async () => {
            const qty = parseInt(document.getElementById('refill-qty').value);
            if (isNaN(qty) || qty <= 0) return showToast('Cantidad no válida', 'error');

            const { error } = await supabase.from('products').update({ stock: (p.stock || 0) + qty }).eq('id', id);
            if (error) showToast('Error al actualizar', 'error');
            else {
                showToast('✨ Inventario actualizado');
                document.getElementById('refill-modal').remove();

                // Refresh logic
                if (window.setView) {
                    window.setView('inventory');
                } else {
                    renderInventoryView(container);
                }
            }
        });
    };

    window.openWithdrawModal = async (id) => {
        const { data: p } = await supabase.from('products').select('*').eq('id', id).single();
        if (!p) return;

        const modalHTML = `
            <div id="withdraw-modal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in text-gray-800">
                <div class="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl">
                    <div class="text-center mb-6">
                        <div class="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">📉</div>
                        <h3 class="text-2xl font-black tracking-tight capitalize mb-1">Salida: ${p.name.toLowerCase()}</h3>
                        <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest">Registrar merma, regalo o defecto</p>
                    </div>
                    
                    <div class="space-y-4 mb-8">
                        <div>
                            <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Unidades a retirar</label>
                            <input type="number" id="withdraw-qty" value="1" min="1" max="${p.stock}" class="w-full text-center text-4xl font-black p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-red-500 focus:bg-white outline-none transition-all text-red-500">
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Motivo / Razón</label>
                            <select id="withdraw-reason" class="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-red-500/20 outline-none appearance-none cursor-pointer">
                                <option value="defectuoso">Producto Defectuoso / Merma</option>
                                <option value="regalo">Cortesía / Regalo</option>
                                <option value="consumo_interno">Consumo Interno</option>
                                <option value="otro">Otro Motivo</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <button onclick="document.getElementById('withdraw-modal').remove()" class="py-4 rounded-2xl font-black text-gray-400 hover:bg-gray-100 transition uppercase tracking-widest text-[10px]">Cancelar</button>
                        <button id="btn-confirm-withdraw" class="py-4 bg-red-500 text-white rounded-2xl font-black shadow-lg shadow-red-500/20 transition active:scale-95 uppercase tracking-widest text-[10px]">Confirmar Salida</button>
                    </div>
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = modalHTML;
        document.body.appendChild(div.firstElementChild);

        document.getElementById('btn-confirm-withdraw').addEventListener('click', async () => {
            const qty = parseInt(document.getElementById('withdraw-qty').value);
            const reason = document.getElementById('withdraw-reason').value;

            if (isNaN(qty) || qty <= 0) return showToast('Cantidad no válida', 'error');
            if (qty > p.stock) return showToast('No puedes retirar más de lo que hay', 'error');

            const { error } = await supabase
                .from('products')
                .update({ stock: p.stock - qty })
                .eq('id', id);

            if (error) showToast('Error al procesar salida', 'error');
            else {
                showToast(`📉 Salida registrada: -${qty} ${p.name} (${reason})`);
                document.getElementById('withdraw-modal').remove();

                // Refresh logic
                if (window.setView) {
                    window.setView('inventory');
                } else {
                    renderInventoryView(container);
                }
            }
        });
    };
}
