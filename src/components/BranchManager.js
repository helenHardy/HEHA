import { supabase } from '../services/supabase.js';
import { store } from '../store.js';

export async function renderBranchManager(container) {
    if (store.user?.role !== 'admin') {
        container.innerHTML = '<div class="p-10 text-center text-red-500 font-bold">Sin permisos para esta sección</div>';
        return;
    }

    // 1. Fetch Data
    const { data: branches } = await supabase.from('branches').select('*').order('name');
    const { data: profiles } = await supabase.from('profiles').select('*').order('full_name');
    const { data: assignments } = await supabase.from('profile_branches').select('*, profiles(full_name), branches(name)');

    // 2. Main Template
    container.innerHTML = `
    <div class="space-y-10 animate-fade-in pb-20">
        <!-- Header -->
        <div class="flex justify-between items-center">
            <div>
                <h2 class="text-4xl font-black text-gray-800 tracking-tight">Gestión de Sucursales</h2>
                <p class="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Administra tus puntos de venta y accesos</p>
            </div>
            <button id="btn-add-branch" class="bg-black text-white px-8 py-4 rounded-2xl shadow-xl shadow-black/20 hover:scale-[1.02] transition active:scale-95 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                <span class="text-lg">+</span> Nueva Sucursal
            </button>
        </div>

        <!-- Branch Form (Hidden by default) -->
        <div id="branch-form-container" class="hidden animate-fade-in-up">
            <div class="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-10 -mt-10"></div>
                
                <h3 class="font-black text-2xl text-gray-800 tracking-tight mb-8" id="branch-form-title">Información de la Sucursal</h3>
                <input type="hidden" id="branch-id">
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Nombre Comercial</label>
                        <input type="text" id="branch-name" placeholder="Ej. HEHA San Miguel" class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Ciudad</label>
                        <input type="text" id="branch-city" placeholder="La Paz" class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm">
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Dirección Exacta</label>
                        <input type="text" id="branch-address" placeholder="Av. Principal #123, entre Calle A y B" class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Teléfono / WhatsApp</label>
                        <input type="text" id="branch-phone" placeholder="70012345" class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm">
                    </div>
                    <div class="flex items-end mb-1">
                        <label class="flex items-center gap-3 cursor-pointer bg-gray-50 p-4 rounded-2xl w-full h-[58px]">
                            <input type="checkbox" id="branch-active" checked class="w-5 h-5 accent-black">
                            <span class="text-xs font-black text-gray-600 uppercase">Sucursal Operativa</span>
                        </label>
                    </div>
                </div>

                <div class="flex gap-4 justify-end">
                    <button id="btn-cancel-branch" class="px-8 py-4 font-black text-xs uppercase tracking-widest text-gray-400 hover:text-gray-800 transition">Cancelar</button>
                    <button id="btn-save-branch" class="bg-black text-white font-black px-12 py-4 rounded-2xl shadow-xl shadow-black/20 hover:scale-[1.02] transition active:scale-95 text-xs uppercase tracking-widest">
                        Guardar Sucursal
                    </button>
                </div>
            </div>
        </div>

        <!-- Branches List -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${(branches || []).map(b => `
                <div class="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-md transition group overflow-hidden relative">
                    <div class="mb-6 flex justify-between items-start relative z-10">
                        <div class="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-lg">
                            ${b.name[0].toUpperCase()}
                        </div>
                        <div class="flex gap-2">
                            <button onclick="window.editBranch(${b.id})" class="w-9 h-9 flex items-center justify-center bg-gray-50 text-gray-400 hover:text-blue-500 rounded-xl transition">✏️</button>
                            <button onclick="window.deleteBranch(${b.id})" class="w-9 h-9 flex items-center justify-center bg-gray-50 text-gray-400 hover:text-red-500 rounded-xl transition">🗑️</button>
                        </div>
                    </div>
                    <h3 class="text-xl font-black text-gray-800 mb-1 capitalize leading-tight">${b.name.toLowerCase()}</h3>
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-4">${b.city}</p>
                    
                    <div class="space-y-3 pt-4 border-t border-gray-50">
                        <div class="flex items-center gap-3 text-xs text-gray-500 font-medium">
                            <span class="w-5 h-5 flex items-center justify-center bg-blue-50 text-blue-500 rounded-lg">📍</span>
                            ${b.address || 'Sin dirección registrada'}
                        </div>
                        <div class="flex items-center gap-3 text-xs text-gray-500 font-medium">
                            <span class="w-5 h-5 flex items-center justify-center bg-green-50 text-green-500 rounded-lg">📞</span>
                            ${b.phone || 'Sin teléfono'}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- User Assignment Section -->
        <div class="mt-20">
            <div class="mb-8">
                <h3 class="text-2xl font-black text-gray-800 tracking-tight">Personal por Sucursal</h3>
                <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">Define quién puede ver qué sucursal</p>
            </div>

            <div class="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 grid grid-cols-1 lg:grid-cols-3 gap-10">
                <!-- Assign Form -->
                <div class="lg:col-span-1 space-y-6">
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Seleccionar Usuario</label>
                        <select id="assign-user" class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none font-bold text-sm focus:ring-2 focus:ring-black/5 outline-none appearance-none cursor-pointer">
                            <option value="">-- Elige un Personal --</option>
                            ${(profiles || []).map(p => `<option value="${p.id}">${p.full_name} (${p.role})</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Asignar Sucursal</label>
                        <select id="assign-branch" class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none font-bold text-sm focus:ring-2 focus:ring-black/5 outline-none appearance-none cursor-pointer">
                            <option value="">-- Elige una Sucursal --</option>
                            ${(branches || []).map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
                        </select>
                    </div>
                    <button id="btn-save-assignment" class="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition text-xs uppercase tracking-widest">
                        Vincular Acceso
                    </button>
                </div>

                <!-- Assignment List -->
                <div class="lg:col-span-2">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead>
                                <tr class="bg-gray-50/50">
                                    <th class="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest rounded-l-2xl">Personal</th>
                                    <th class="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursal Autorizada</th>
                                    <th class="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest rounded-r-2xl text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50">
                                ${(assignments || []).map(a => `
                                    <tr>
                                        <td class="py-4 px-6">
                                            <p class="font-black text-gray-800 text-sm capitalize">${(a.profiles?.full_name || 'Desconocido').toLowerCase()}</p>
                                        </td>
                                        <td class="py-4 px-6">
                                            <span class="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-tighter">${a.branches?.name || 'Error'}</span>
                                        </td>
                                        <td class="py-4 px-6 text-right">
                                            <button onclick="window.deleteAssignment('${a.profile_id}', ${a.branch_id})" class="text-red-300 hover:text-red-500 transition text-sm">✕</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    // 3. Listeners
    const formSection = document.getElementById('branch-form-container');
    const branchIdInput = document.getElementById('branch-id');
    const nameInput = document.getElementById('branch-name');
    const cityInput = document.getElementById('branch-city');
    const addressInput = document.getElementById('branch-address');
    const phoneInput = document.getElementById('branch-phone');
    const activeInput = document.getElementById('branch-active');

    document.getElementById('btn-add-branch').onclick = () => {
        formSection.classList.remove('hidden');
        document.getElementById('branch-form-title').innerText = 'Nueva Sucursal';
        clearForm();
        formSection.scrollIntoView({ behavior: 'smooth' });
    };

    document.getElementById('btn-cancel-branch').onclick = () => {
        formSection.classList.add('hidden');
        clearForm();
    };

    document.getElementById('btn-save-branch').onclick = async () => {
        const id = branchIdInput.value;
        const name = nameInput.value.trim();
        const city = cityInput.value.trim();
        const address = addressInput.value.trim();
        const phone = phoneInput.value.trim();
        const active = activeInput.checked;

        if (!name) return window.showToast('El nombre es obligatorio', 'error');

        const branchData = { name, city, address, phone, is_active: active };

        if (id) {
            await supabase.from('branches').update(branchData).eq('id', id);
        } else {
            await supabase.from('branches').insert(branchData);
        }

        window.showToast('✨ Sucursal actualizada');
        renderBranchManager(container);
    };

    document.getElementById('btn-save-assignment').onclick = async () => {
        const profile_id = document.getElementById('assign-user').value;
        const branch_id = document.getElementById('assign-branch').value;

        if (!profile_id || !branch_id) return window.showToast('Selecciona usuario y sucursal', 'error');

        const { error } = await supabase.from('profile_branches').insert({ profile_id, branch_id });
        if (error) {
            window.showToast('Este usuario ya tiene acceso a esta sucursal', 'error');
        } else {
            window.showToast('🔐 Acceso vinculado');
            renderBranchManager(container);
        }
    };

    // 4. Global Actions
    window.editBranch = async (id) => {
        const { data: b } = await supabase.from('branches').select('*').eq('id', id).single();
        if (b) {
            branchIdInput.value = b.id;
            nameInput.value = b.name;
            cityInput.value = b.city;
            addressInput.value = b.address;
            phoneInput.value = b.phone;
            activeInput.checked = b.is_active;

            document.getElementById('branch-form-title').innerText = 'Editando ' + b.name;
            formSection.classList.remove('hidden');
            formSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    window.deleteBranch = async (id) => {
        if (!confirm('¿Eliminar esta sucursal? Se perderán las vinculaciones de personal.')) return;
        await supabase.from('branches').delete().eq('id', id);
        renderBranchManager(container);
    };

    window.deleteAssignment = async (profileId, branchId) => {
        if (!confirm('¿Remover acceso a esta sucursal?')) return;
        await supabase.from('profile_branches').delete().eq('profile_id', profileId).eq('branch_id', branchId);
        renderBranchManager(container);
    };

    function clearForm() {
        branchIdInput.value = '';
        nameInput.value = '';
        cityInput.value = 'La Paz';
        addressInput.value = '';
        phoneInput.value = '';
        activeInput.checked = true;
    }
}
