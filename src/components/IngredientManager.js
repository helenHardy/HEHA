import { supabase } from '../services/supabase.js';
import { store } from '../store.js';

export async function renderIngredientManager(container) {
    container.innerHTML = `
    <div class="flex flex-col animate-fade-in pb-20">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
                <h2 class="text-3xl font-[1000] text-gray-900 tracking-tighter uppercase italic leading-none">
                    Ingredientes <span class="text-primary font-black">Base</span>
                </h2>
                <p class="text-gray-400 font-black uppercase text-[10px] tracking-[0.2em] mt-2">
                    Control de presas, pan y materias primas
                </p>
            </div>
            <button id="btn-new-ingredient" class="bg-black hover:bg-gray-800 text-white px-8 py-4 rounded-[1.5rem] font-black shadow-xl shadow-black/10 flex items-center gap-3 transform transition active:scale-95 text-sm uppercase tracking-tighter">
                <span class="text-xl">➕</span>
                <span>Nuevo Ingrediente</span>
            </button>
        </div>

        <!-- Stats Overview -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" id="ingredient-stats">
            <!-- Filled by JS -->
        </div>

        <div class="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-gray-100 overflow-visible flex-1 flex flex-col">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
                            <th class="p-6">Ingrediente</th>
                            <th class="p-6">Stock Actual</th>
                            <th class="p-6">Unidad</th>
                            <th class="p-6">Mínimo</th>
                            <th class="p-6">Estado</th>
                            <th class="p-6 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="ingredients-table-body" class="text-gray-600 text-sm font-bold">
                        <tr><td colspan="6" class="p-20 text-center text-gray-300">Cargando ingredientes...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- MODAL INGREDIENTE -->
    <div id="ingredient-modal" class="fixed inset-0 bg-black/60 backdrop-blur-xl z-[200] hidden flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white w-full max-w-lg rounded-[3.5rem] p-10 md:p-14 shadow-[0_50px_100px_rgba(0,0,0,0.3)] animate-bounce-in-up relative overflow-hidden">
            <h3 class="text-4xl font-[1000] text-gray-900 tracking-tighter leading-none mb-2" id="modal-title">NUEVO INGREDIENTE</h3>
            <p class="text-gray-400 font-black uppercase text-xs tracking-widest mb-10">Materia prima para recetas</p>

            <form id="ingredient-form" class="space-y-6">
                <input type="hidden" id="ingredient-id">
                
                <div class="space-y-2">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre del Ingrediente</label>
                    <input type="text" id="ing-name" required placeholder="Ej. Presa de Pollo 1/8" 
                           class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none font-bold text-gray-700 focus:ring-4 focus:ring-primary/10 transition outline-none">
                </div>

                <div class="grid grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Stock Inicial</label>
                        <input type="number" id="ing-stock" required value="0" min="0"
                               class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none font-black text-xl text-gray-800 focus:ring-4 focus:ring-primary/10 transition outline-none">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Unidad</label>
                        <select id="ing-unit" class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none font-bold text-gray-700 focus:ring-4 focus:ring-primary/10 transition outline-none">
                            <option value="unidad">Unidad</option>
                            <option value="kg">Kilogramos</option>
                            <option value="lt">Litros</option>
                            <option value="gr">Gramos</option>
                        </select>
                    </div>
                </div>

                <div class="space-y-2">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Stock Mínimo (Alerta)</label>
                    <input type="number" id="ing-min" required value="5" min="0"
                           class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none font-bold text-gray-700 focus:ring-4 focus:ring-primary/10 transition outline-none">
                </div>

                <div class="pt-6 flex gap-4">
                    <button type="button" id="btn-cancel-ing" class="flex-1 py-5 font-black text-gray-400 hover:text-gray-600 transition uppercase tracking-widest text-[10px]">Cancelar</button>
                    <button type="submit" class="flex-[2] bg-primary hover:bg-orange-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-primary/20 transition active:scale-95 uppercase tracking-tighter">Guardar Ingrediente</button>
                </div>
            </form>
        </div>
    </div>
  `;

    // --- EVENT LISTENERS ---
    const modal = document.getElementById('ingredient-modal');
    const form = document.getElementById('ingredient-form');

    document.getElementById('btn-new-ingredient').addEventListener('click', () => {
        form.reset();
        document.getElementById('ingredient-id').value = '';
        document.getElementById('modal-title').innerText = 'NUEVO INGREDIENTE';
        modal.classList.remove('hidden');
    });

    document.getElementById('btn-cancel-ing').addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('ingredient-id').value;
        const name = document.getElementById('ing-name').value;
        const stock = parseInt(document.getElementById('ing-stock').value);
        const unit = document.getElementById('ing-unit').value;
        const min = parseInt(document.getElementById('ing-min').value);

        try {
            if (id) {
                await supabase.from('ingredients').update({ name, stock, unit, min_stock: min }).eq('id', id);
                window.showToast('✅ Ingrediente actualizado');
            } else {
                await supabase.from('ingredients').insert({ name, stock, unit, min_stock: min });
                window.showToast('✅ Ingrediente creado');
            }
            modal.classList.add('hidden');
            loadIngredients();
        } catch (err) {
            console.error(err);
            window.showToast('Error al guardar ingrediente', 'error');
        }
    });

    // Global actions
    window.editIngredient = (ingStr) => {
        const ing = JSON.parse(decodeURIComponent(ingStr));
        document.getElementById('ingredient-id').value = ing.id;
        document.getElementById('ing-name').value = ing.name;
        document.getElementById('ing-stock').value = ing.stock;
        document.getElementById('ing-unit').value = ing.unit;
        document.getElementById('ing-min').value = ing.min_stock;
        document.getElementById('modal-title').innerText = 'EDITAR INGREDIENTE';
        modal.classList.remove('hidden');
    };

    window.deleteIngredient = async (id, name) => {
        if (!confirm(`¿Seguro que deseas eliminar "${name}"? Esto afectará a las recetas que lo usen.`)) return;
        try {
            await supabase.from('ingredients').delete().eq('id', id);
            window.showToast('🗑️ Ingrediente eliminado');
            loadIngredients();
        } catch (err) {
            console.error(err);
            window.showToast('Error al eliminar', 'error');
        }
    };

    window.addStockIngredient = async (id, currentStock, name) => {
        const amount = prompt(`¿Cuántas unidades de "${name}" deseas agregar al stock actual (${currentStock})?`);
        if (!amount || isNaN(amount)) return;

        try {
            const { error } = await supabase
                .from('ingredients')
                .update({ stock: currentStock + parseInt(amount) })
                .eq('id', id);

            if (error) throw error;
            window.showToast('📦 Stock actualizado');
            loadIngredients();
        } catch (err) {
            console.error(err);
            window.showToast('Error al actualizar stock', 'error');
        }
    };

    const loadIngredients = async () => {
        const { data: ings, error } = await supabase.from('ingredients').select('*').order('name');
        const tbody = document.getElementById('ingredients-table-body');
        const statsContainer = document.getElementById('ingredient-stats');

        if (error) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
            return;
        }

        if (!ings || ings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-20 text-center text-gray-300">No hay ingredientes registrados.</td></tr>`;
            statsContainer.innerHTML = '';
            return;
        }

        // Render Stats
        const lowStockCount = ings.filter(i => i.stock <= i.min_stock).length;
        statsContainer.innerHTML = `
        <div class="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div class="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center text-2xl">🧊</div>
            <div>
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Ingredientes</p>
                <p class="text-2xl font-black text-gray-900">${ings.length}</p>
            </div>
        </div>
        <div class="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div class="w-14 h-14 ${lowStockCount > 0 ? 'bg-red-50 text-red-500 animate-pulse' : 'bg-green-50 text-green-500'} rounded-2xl flex items-center justify-center text-2xl">⚠️</div>
            <div>
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock Crítico</p>
                <p class="text-2xl font-black ${lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}">${lowStockCount}</p>
            </div>
        </div>
        <div class="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div class="w-14 h-14 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center text-2xl">🍗</div>
            <div>
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Último Envío</p>
                <p class="text-sm font-black text-gray-900">Hace poco</p>
            </div>
        </div>
    `;

        // Render Table
        tbody.innerHTML = ings.map(i => {
            const isLow = i.stock <= i.min_stock;
            const ingStr = encodeURIComponent(JSON.stringify(i));

            return `
        <tr class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
            <td class="p-6">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg grayscale group-hover:grayscale-0 transition">
                        ${i.name.toLowerCase().includes('pollo') ? '🍗' : i.name.toLowerCase().includes('pan') ? '🍞' : '📦'}
                    </div>
                    <span class="capitalize">${i.name.toLowerCase()}</span>
                </div>
            </td>
            <td class="p-6">
                <span class="text-lg ${isLow ? 'text-red-600' : 'text-gray-900'}">${i.stock}</span>
            </td>
            <td class="p-6 text-gray-400 uppercase text-[10px] tracking-widest">${i.unit}</td>
            <td class="p-6 text-gray-400 font-medium italic">${i.min_stock}</td>
            <td class="p-6 font-bold text-gray-400 uppercase text-xs">
                ${isLow ?
                    '<span class="flex items-center gap-1.5 text-red-500 bg-red-50 px-3 py-1 rounded-full text-[10px] w-fit animate-pulse border border-red-100">● Reponer</span>' :
                    '<span class="flex items-center gap-1.5 text-green-500 bg-green-50 px-3 py-1 rounded-full text-[10px] w-fit border border-green-100">● Óptimo</span>'}
            </td>
            <td class="p-6 text-right">
                <div class="flex justify-end gap-2 opacity-40 group-hover:opacity-100 transition">
                    <button onclick="addStockIngredient(${i.id}, ${i.stock}, '${i.name}')" class="p-2 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition" title="Reponer Stock">
                        📦
                    </button>
                    <button onclick="editIngredient('${ingStr}')" class="p-2 hover:bg-gray-100 hover:text-gray-900 rounded-xl transition" title="Editar">
                        ✏️
                    </button>
                    <button onclick="deleteIngredient(${i.id}, '${i.name}')" class="p-2 hover:bg-red-50 hover:text-red-600 rounded-xl transition" title="Eliminar">
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
      `;
        }).join('');
    };

    loadIngredients();
}
