import { supabase } from '../services/supabase.js';
import { store } from '../store.js';

export async function renderProductManager(container) {
  // 1. Fetch Products and Categories
  // Fetch all global products
  const { data: allProducts } = await supabase.from('products').select('*');
  // Fetch branch-specific data for the active branch
  const { data: branchData } = await supabase
    .from('branch_products')
    .select('*')
    .eq('branch_id', store.activeBranchId);

  const products = (allProducts || []).map(p => {
    const bp = (branchData || []).find(x => x.product_id === p.id);
    return {
      ...p,
      price: bp ? bp.price : p.price, // Fallback to global price if not set
      stock: bp ? bp.stock : 0,
      is_available: bp ? bp.is_available : true,
      track_stock: bp ? bp.track_stock : false,
      is_configured: !!bp // Helper to show if it has branch data
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const { data: categories } = await supabase.from('categories').select('*').order('name');
  const { data: ingredients } = await supabase.from('ingredients').select('*').eq('branch_id', store.activeBranchId).order('name');

  // Ensure 'General' always exists in UI logic even if DB is empty (fallback)
  const categoryList = categories && categories.length > 0 ? categories : [{ name: 'General' }];

  // 2. Render Template
  container.innerHTML = `
    <div class="space-y-10 animate-fade-in pb-20">
      <!-- Header Section -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 class="text-4xl font-black text-gray-800 tracking-tight">Gestión del Menú</h2>
            <p class="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Administra tus platos, precios y categorías</p>
          </div>
          <div class="flex gap-3 w-full md:w-auto">
              <button id="btn-manage-cats" class="flex-1 md:flex-none group flex items-center justify-center gap-2 bg-white px-6 py-4 rounded-2xl shadow-sm hover:shadow-md border border-gray-100 transition-all active:scale-95 font-black text-xs uppercase tracking-widest text-gray-600">
                 <span>📂</span> Categorías
              </button>
              <button id="btn-add-product" class="flex-1 md:flex-none bg-black text-white px-8 py-4 rounded-2xl shadow-xl shadow-black/20 hover:scale-[1.02] transition active:scale-95 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                 <span class="text-lg">+</span> Nuevo Producto
              </button>
          </div>
      </div>

      <!-- Category Manager Card (Hidden by default) -->
      <div id="category-manager" class="hidden animate-fade-in-up">
          <div class="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 relative overflow-hidden">
             <div class="absolute top-0 left-0 w-2 h-full bg-primary"></div>
             <div class="flex justify-between items-center mb-8">
                <h3 class="font-black text-xl text-gray-800 tracking-tight">Administrar Categorías</h3>
                <button id="btn-close-cats" class="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-red-500 transition">✕</button>
             </div>
             
             <div class="flex gap-3 mb-10 max-w-2xl">
                <input type="text" id="new-cat-name" placeholder="Ej. Bebidas, Postres..." class="flex-1 px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm">
                <button id="btn-save-cat" class="bg-primary text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition active:scale-95 text-xs uppercase tracking-widest">Crear</button>
             </div>
             
             <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                ${categoryList.map(c => `
                   <div class="bg-gray-50 p-4 rounded-2xl flex justify-between items-center group border border-transparent hover:border-gray-200 transition-all">
                       <span class="font-black text-[11px] text-gray-600 uppercase tracking-tighter truncate">${c.name}</span>
                       <button onclick="window.deleteCategory(${c.id})" class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition pl-2">✕</button>
                   </div>
                `).join('')}
             </div>
          </div>
      </div>

      <!-- Product Form Card -->
      <div id="product-form-container" class="hidden animate-fade-in-up">
        <div class="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-gray-100 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-10 -mt-10"></div>
          
          <h3 class="font-black text-2xl text-gray-800 tracking-tight" id="form-title">Agregar Producto</h3>
          <p class="text-[10px] text-primary font-bold uppercase tracking-widest mb-8" id="form-branch-tag"></p>
          <input type="hidden" id="prod-id">
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            <!-- Image Upload Zone -->
            <div class="md:col-span-1">
                <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Imagen del Producto</label>
                <div id="image-upload-zone" class="relative group aspect-square rounded-[2rem] bg-gray-50 border-2 border-dashed border-gray-200 hover:border-primary transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden">
                   <img id="prod-preview" src="" class="absolute inset-0 w-full h-full object-cover hidden">
                   <div id="upload-placeholder" class="text-center p-6 space-y-2">
                      <span class="text-4xl">📸</span>
                      <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Click para subir</p>
                      <p class="text-[9px] text-gray-300 font-bold">PNG, JPG hasta 5MB</p>
                   </div>
                   <input type="file" id="prod-file-input" class="hidden" accept="image/*">
                   <input type="hidden" id="prod-image-url">
                   
                   <!-- Loading Overlay -->
                   <div id="upload-loader" class="absolute inset-0 bg-white/80 items-center justify-center hidden">
                      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                   </div>
                </div>
            </div>

            <!-- Details Fields -->
            <div class="md:col-span-2 grid grid-cols-2 gap-6">
              <div class="col-span-2">
                  <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nombre del Plato</label>
                  <input type="text" id="prod-name" placeholder="Ej. Hamburguesa Doble Queso" class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-lg">
              </div>
              
              <div class="col-span-1">
                  <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 font-mono">Precio Venta (Bs)</label>
                  <div class="relative">
                     <span class="absolute left-6 top-1/2 -translate-y-1/2 font-black text-gray-300">Bs.</span>
                     <input type="number" id="prod-price" placeholder="0.00" step="0.5" class="w-full pl-14 pr-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-primary/10 transition outline-none font-black text-xl text-primary">
                  </div>
              </div>

              <div class="col-span-1">
                  <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 font-mono">Costo Producción (Bs)</label>
                  <div class="relative group">
                     <span class="absolute left-6 top-1/2 -translate-y-1/2 font-black text-gray-300">Bs.</span>
                     <input type="number" id="prod-cost" placeholder="0.00" step="0.5" class="w-full pl-14 pr-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-blue-500/20 outline-none font-black text-xl text-blue-500">
                     <button type="button" id="btn-calc-cost" class="absolute right-2 top-2 h-10 px-4 bg-orange-100 text-orange-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition opacity-0 group-hover:opacity-100">Receta ✨</button>
                  </div>
              </div>

              <div class="col-span-1 bg-gray-900 rounded-[2rem] p-6 flex flex-col justify-center border border-white/5 h-[76px] mt-6">
                   <p class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Utilidad Estimada</p>
                   <p class="text-xl font-black text-green-400 font-mono" id="display-margin">0.00 Bs</p>
              </div>
              
              <div class="col-span-2">
                   <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Categoría Relacionada</label>
                   <select id="prod-category" class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm appearance-none cursor-pointer">
                     ${categoryList.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                   </select>
              </div>

              <!-- Stock Management -->
              <div class="col-span-1">
                   <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Controlar Stock</label>
                   <div class="flex items-center gap-4 bg-gray-50 px-6 py-4 rounded-2xl h-[58px]">
                       <input type="checkbox" id="prod-track-stock" class="w-5 h-5 accent-black">
                       <span class="text-xs font-bold text-gray-600 uppercase">Activar</span>
                   </div>
              </div>

              <div class="col-span-1">
                   <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 font-mono">Stock Actual</label>
                   <input type="number" id="prod-stock" placeholder="0" class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-orange-500/20 outline-none font-black text-xl text-orange-500">
              </div>

              <div class="col-span-1">
                   <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 font-mono">Disponibilidad</label>
                   <div class="flex items-center gap-4 bg-gray-50 px-6 py-4 rounded-2xl h-[58px]">
                       <input type="checkbox" id="prod-available" class="w-5 h-5 accent-green-500" checked>
                       <span class="text-xs font-bold text-gray-600 uppercase">Disponible</span>
                   </div>
              </div>

              <div class="col-span-2">
                   <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Descripción Corta</label>
                   <textarea id="prod-desc" placeholder="Detalles de los ingredientes o preparación..." class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none font-medium text-sm scrollbar-hide" rows="3"></textarea>
              </div>

              <!-- Recipe Section -->
              <div class="col-span-2 mt-4 p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100">
                <div class="flex justify-between items-center mb-6">
                  <div>
                    <h4 class="font-black text-lg text-gray-800 tracking-tight">Receta / Insumos</h4>
                    <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Descontar stock de ingredientes base</p>
                  </div>
                  <button type="button" id="btn-add-recipe-item" class="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition">
                    + Agregar Insumo
                  </button>
                </div>
                <div id="recipe-items-container" class="space-y-3">
                  <!-- Injected by JS -->
                </div>
                <p id="no-recipe-msg" class="text-center py-4 text-gray-400 text-xs italic">Este producto no consume ingredientes base (ej. Refrescos)</p>
              </div>
            </div>
          </div>

          <div class="flex gap-4 justify-end pt-6 border-t border-gray-50">
            <button id="btn-cancel-prod" class="px-8 py-4 font-black text-xs uppercase tracking-widest text-gray-400 hover:text-gray-800 transition">Descartar</button>
            <button id="btn-save-prod" class="bg-black text-white font-black px-12 py-4 rounded-2xl shadow-xl shadow-black/20 hover:scale-[1.02] transition active:scale-95 text-xs uppercase tracking-widest">
               Guardar Producto
            </button>
          </div>
        </div>
      </div>

      <!-- Category Filter Tabs -->
      <div class="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        <button class="cat-filter-btn active-cat-filter px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap bg-black text-white shadow-lg shadow-black/20" data-cat="all">
           📋 Todos (${products ? products.length : 0})
        </button>
        ${categoryList.map(c => {
    const count = products ? products.filter(p => (p.category || 'General') === c.name).length : 0;
    return count > 0 ? `
            <button class="cat-filter-btn px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap bg-white text-gray-500 border border-gray-100 hover:border-gray-300 hover:shadow-md" data-cat="${c.name}">
               ${c.name} (${count})
            </button>
          ` : '';
  }).join('')}
      </div>

      <!-- Products Grouped by Category -->
      <div id="products-by-category" class="grid grid-cols-1 gap-8">
        ${(() => {
      if (!products || products.length === 0) {
        return '<div class="bg-white rounded-[3rem] shadow-sm border border-gray-100 py-40 text-center text-gray-300 font-black uppercase tracking-widest text-xs">No hay productos en el menú</div>';
      }
      // Group products by category
      const grouped = {};
      products.forEach(p => {
        const cat = p.category || 'General';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
      });
      const catStyles = [
        { bg: 'bg-blue-50', text: 'text-blue-500', border: 'border-blue-100' },
        { bg: 'bg-purple-50', text: 'text-purple-500', border: 'border-purple-100' },
        { bg: 'bg-emerald-50', text: 'text-emerald-500', border: 'border-emerald-100' },
        { bg: 'bg-orange-50', text: 'text-orange-500', border: 'border-orange-100' },
        { bg: 'bg-pink-50', text: 'text-pink-500', border: 'border-pink-100' },
        { bg: 'bg-cyan-50', text: 'text-cyan-500', border: 'border-cyan-100' },
        { bg: 'bg-amber-50', text: 'text-amber-500', border: 'border-amber-100' },
        { bg: 'bg-rose-50', text: 'text-rose-500', border: 'border-rose-100' },
        { bg: 'bg-teal-50', text: 'text-teal-500', border: 'border-teal-100' },
        { bg: 'bg-indigo-50', text: 'text-indigo-500', border: 'border-indigo-100' },
      ];
      return Object.keys(grouped).map((cat, idx) => {
        const style = catStyles[idx % catStyles.length];
        const prods = grouped[cat];
        return `
              <div class="cat-section" data-cat="${cat}">
                <!-- Category Header -->
                <div class="flex items-center gap-4 mb-4">
                  <div class="h-10 w-10 ${style.bg} ${style.text} rounded-2xl flex items-center justify-center text-lg font-black border ${style.border}">
                    ${cat[0].toUpperCase()}
                  </div>
                  <div class="flex-1">
                    <h3 class="font-black text-xl text-gray-800 tracking-tight">${cat}</h3>
                    <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${prods.length} producto${prods.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div class="h-px flex-1 bg-gray-100"></div>
                </div>
                
                <!-- Category Table -->
                <div class="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                  <div class="overflow-x-auto scrollbar-hide">
                    <table class="w-full text-left border-collapse">
                      <thead>
                        <tr class="bg-gray-50/50">
                          <th class="py-5 px-10 text-[10px] font-black text-gray-400 uppercase tracking-widest">Plato</th>
                          <th class="py-5 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Costo</th>
                          <th class="py-5 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Estatus</th>
                          <th class="py-5 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Stock</th>
                          <th class="py-5 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Precio</th>
                          <th class="py-5 px-10 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-50">
                        ${prods.map(p => `
                          <tr class="group hover:bg-gray-50/50 transition-colors">
                            <td class="py-5 px-10">
                              <div class="flex items-center gap-5">
                                <div class="h-14 w-14 rounded-2xl bg-gray-50 overflow-hidden flex-shrink-0 shadow-sm border border-gray-100 group-hover:scale-105 transition duration-500">
                                  <img src="${p.image_url}" class="h-full w-full object-cover" onerror="this.src='https://placehold.co/100x100?text=${p.name[0]}'">
                                </div>
                                 <div>
                                    <p class="font-black text-gray-800 text-base capitalize leading-tight">${p.name.toLowerCase()}</p>
                                    <p class="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest truncate w-40">${p.description || 'Sin descripción'}</p>
                                    <div id="recipe-preview-${p.id}" class="mt-2 flex flex-wrap gap-1"></div>
                                 </div>
                              </div>
                            </td>
                            <td class="py-5 px-4 text-right">
                               <p class="font-bold text-xs text-gray-400 font-mono">Bs. ${p.cost.toFixed(2)}</p>
                            </td>
                            <td class="py-5 px-4 text-right">
                               <div class="flex flex-col items-end">
                                  <button onclick="window.toggleProductAvailability(${p.id}, ${p.is_available === false ? 'true' : 'false'})" 
                                          class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                                          ${p.is_available !== false ? 'bg-green-50 text-green-600 border border-green-100 hover:bg-green-100' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}">
                                     ${p.is_available !== false ? '✅ Activo' : '🚫 Agotado'}
                                  </button>
                               </div>
                            </td>
                            <td class="py-5 px-4 text-right">
                               <div class="flex flex-col items-end">
                                  <p class="font-black text-lg tabular-nums ${p.track_stock && p.stock <= 5 ? 'text-red-500' : 'text-gray-800'}">
                                    ${p.track_stock ? p.stock : '∞'}
                                  </p>
                                  <span class="text-[9px] font-black uppercase tracking-tighter ${p.track_stock ? 'text-gray-400' : 'text-blue-400'}">
                                    ${p.track_stock ? (p.stock <= 5 ? '¡BAJO!' : 'STOCK') : 'SIN LÍMITE'}
                                  </span>
                               </div>
                            </td>
                            <td class="py-5 px-4 text-right">
                               <div class="flex flex-col items-end">
                                  <p class="font-black text-gray-800 text-lg tabular-nums">Bs. ${p.price.toFixed(2)}</p>
                                  <span class="text-[9px] font-black text-green-500 uppercase tracking-tighter">Profit Bs. ${(p.price - (p.cost || 0)).toFixed(2)}</span>
                               </div>
                            </td>
                            <td class="py-5 px-10 text-right">
                              <div class="flex justify-end gap-2">
                                ${p.track_stock ? `
                                  <button class="w-8 h-8 flex items-center justify-center bg-green-50 text-green-600 rounded-lg hover:bg-green-500 hover:text-white transition active:scale-90" onclick="window.openRefillModal(${p.id})" title="Reponer Stock">
                                     ➕
                                  </button>
                                  <button class="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition active:scale-90" onclick="window.openWithdrawModal(${p.id})" title="Registrar Salida">
                                     📉
                                  </button>
                                ` : ''}
                                <button class="w-10 h-10 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-blue-500 hover:shadow-md transition active:scale-90" onclick="window.editProduct(${p.id})">
                                   ✏️
                                </button>
                                <button class="w-10 h-10 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-red-500 hover:shadow-md transition active:scale-90" onclick="window.deleteProduct(${p.id})">
                                   🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            `;
      }).join('');
    })()}
    </div>
  `;

  // --- RECIPE LOGIC ---
  const recipeContainer = document.getElementById('recipe-items-container');
  const noRecipeMsg = document.getElementById('no-recipe-msg');
  let currentRecipe = [];

  const conditionIcons = {
    'always': '♾️',
    'llevar': '🥡',
    'mesa': '🍽️',
    'whatsapp': '📱'
  };

  const renderRecipeItems = () => {
    if (currentRecipe.length === 0) {
      recipeContainer.innerHTML = '';
      noRecipeMsg.classList.remove('hidden');
      updatePriceStats();
      return;
    }
    noRecipeMsg.classList.add('hidden');
    const totalRecipe = currentRecipe.reduce((sum, item) => {
        const ing = ingredients.find(i => i.id == item.ingredient_id);
        return sum + (ing ? (ing.unit_cost * item.quantity) : 0);
    }, 0);

    recipeContainer.innerHTML = currentRecipe.map((item, index) => {
        const ing = ingredients.find(i => i.id == item.ingredient_id);
        const subtotal = ing ? (ing.unit_cost * item.quantity).toFixed(2) : '0.00';
        
        return `
      <div class="flex gap-2 items-center animate-fade-in group">
        <select class="recipe-ing-select flex-1 px-3 py-3 rounded-xl bg-white border border-gray-100 text-[10px] font-bold font-sans" data-index="${index}">
          <option value="">-- Seleccionar Insumo --</option>
          ${ingredients.map(ing => `<option value="${ing.id}" ${item.ingredient_id == ing.id ? 'selected' : ''}>${ing.name} (${ing.unit})</option>`).join('')}
        </select>
        
        <div class="w-32 relative">
          <select class="recipe-cond-select w-full px-3 py-3 rounded-xl bg-white border border-gray-100 text-[10px] font-black text-center pr-8" data-index="${index}">
            <option value="always" ${item.usage_condition === 'always' || !item.usage_condition ? 'selected' : ''}> Siempre</option>
            <option value="llevar" ${item.usage_condition === 'llevar' ? 'selected' : ''}>🥡 Llevar</option>
            <option value="mesa" ${item.usage_condition === 'mesa' ? 'selected' : ''}>🍽️ Mesa</option>
            <option value="whatsapp" ${item.usage_condition === 'whatsapp' ? 'selected' : ''}>📱 WA</option>
          </select>
          <span class="absolute -top-2 left-2 bg-white px-1 text-[8px] font-black text-gray-400 uppercase tracking-widest">Uso</span>
        </div>

        <div class="w-20 relative">
          <input type="number" step="0.01" min="0.01" class="recipe-qty-input w-full px-3 py-3 rounded-xl bg-white border border-gray-100 text-[10px] font-black text-center" value="${item.quantity}" data-index="${index}">
          <span class="absolute -top-2 left-2 bg-white px-1 text-[8px] font-black text-gray-400 uppercase tracking-widest">Cant</span>
        </div>
        
        <div class="w-20 text-right">
           <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Bs. ${subtotal}</p>
        </div>
        <button type="button" onclick="window.removeRecipeItem(${index})" class="w-8 h-8 flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">✕</button>
      </div>
    `;
    }).join('') + `
    <!-- Total Recipe Footer -->
    <div class="flex justify-end items-center gap-3 pt-6 mt-4 border-t border-dashed border-gray-100">
        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Receta</p>
        <p class="text-xl font-black text-gray-900 font-mono">Bs. ${totalRecipe.toFixed(2)}</p>
        <div class="w-10"></div> <!-- spacer for the delete button alignment -->
    </div>
    `;

    // Attach local listeners to selects and inputs
    document.querySelectorAll('.recipe-ing-select').forEach(el => {
      el.onchange = (e) => {
        currentRecipe[e.target.dataset.index].ingredient_id = e.target.value;
        renderRecipeItems();
        updatePriceStats();
      };
    });
    document.querySelectorAll('.recipe-cond-select').forEach(el => {
      el.onchange = (e) => {
        currentRecipe[e.target.dataset.index].usage_condition = e.target.value;
        renderRecipeItems();
        updatePriceStats();
      };
    });
    document.querySelectorAll('.recipe-qty-input').forEach(el => {
      el.oninput = (e) => {
        currentRecipe[e.target.dataset.index].quantity = parseFloat(e.target.value) || 0;
        renderRecipeItems();
        updatePriceStats();
      };
    });
  };

  const updatePriceStats = () => {
    const price = parseFloat(document.getElementById('prod-price').value) || 0;
    const costInput = document.getElementById('prod-cost');
    const marginDisplay = document.getElementById('display-margin');

    const recipeCost = currentRecipe.reduce((sum, item) => {
       const ing = ingredients.find(i => i.id == item.ingredient_id);
       return sum + (ing ? (ing.unit_cost * item.quantity) : 0);
    }, 0);

    const activeCost = parseFloat(costInput.value) || 0;
    const margin = price - activeCost;
    
    marginDisplay.innerText = `${margin.toFixed(2)} Bs`;
    marginDisplay.className = `text-xl font-black font-mono ${margin >= 0 ? 'text-green-400' : 'text-red-400'}`;
  };

  document.getElementById('btn-calc-cost').onclick = () => {
     const recipeCost = currentRecipe.reduce((sum, item) => {
       const ing = ingredients.find(i => i.id == item.ingredient_id);
       return sum + (ing ? (ing.unit_cost * item.quantity) : 0);
     }, 0);
     document.getElementById('prod-cost').value = recipeCost.toFixed(2);
     updatePriceStats();
     window.showToast('✨ Costo actualizado según receta');
  };

  document.getElementById('prod-price').oninput = updatePriceStats;
  document.getElementById('prod-cost').oninput = updatePriceStats;

  document.getElementById('btn-add-recipe-item').onclick = () => {
    currentRecipe.push({ ingredient_id: '', quantity: 1 });
    renderRecipeItems();
  };

  window.removeRecipeItem = (index) => {
    currentRecipe.splice(index, 1);
    renderRecipeItems();
  };

  // 3. Attach Listeners
  const formSection = document.getElementById('product-form-container');
  const catManager = document.getElementById('category-manager');
  const fileInput = document.getElementById('prod-file-input');
  const uploadZone = document.getElementById('image-upload-zone');
  const previewImg = document.getElementById('prod-preview');
  const placeholder = document.getElementById('upload-placeholder');
  const loader = document.getElementById('upload-loader');

  // Toggle Forms
  document.getElementById('btn-add-product').addEventListener('click', () => {
    clearFormFields();
    currentRecipe = [];
    renderRecipeItems();
    document.getElementById('form-title').innerText = 'Nuevo Plato en el Menú';
    const branch = store.branches.find(b => b.id === store.activeBranchId);
    document.getElementById('form-branch-tag').innerText = `Configurando para: ${branch?.name || 'Sucursal Actual'}`;
    catManager.classList.add('hidden');
    formSection.classList.remove('hidden');
    formSection.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('btn-manage-cats').addEventListener('click', () => {
    formSection.classList.add('hidden');
    catManager.classList.remove('hidden');
    catManager.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('btn-close-cats').addEventListener('click', () => {
    catManager.classList.add('hidden');
  });

  document.getElementById('btn-cancel-prod').addEventListener('click', () => {
    formSection.classList.add('hidden');
    clearFormFields();
  });

  // Category Filter Tabs
  document.querySelectorAll('.cat-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      document.querySelectorAll('.cat-filter-btn').forEach(b => {
        b.classList.remove('bg-black', 'text-white', 'shadow-lg', 'shadow-black/20');
        b.classList.add('bg-white', 'text-gray-500', 'border', 'border-gray-100');
      });
      btn.classList.remove('bg-white', 'text-gray-500', 'border', 'border-gray-100');
      btn.classList.add('bg-black', 'text-white', 'shadow-lg', 'shadow-black/20');

      // Filter sections
      const selectedCat = btn.dataset.cat;
      document.querySelectorAll('.cat-section').forEach(section => {
        if (selectedCat === 'all' || section.dataset.cat === selectedCat) {
          section.classList.remove('hidden');
        } else {
          section.classList.add('hidden');
        }
      });
    });
  });

  // Image Upload Logic
  uploadZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Local Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewImg.classList.remove('hidden');
      placeholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);

    // Upload to Supabase
    loader.classList.remove('hidden');
    loader.classList.add('flex');

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `product-images/${fileName}`;

    try {
      const { data, error } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (error) throw error;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      document.getElementById('prod-image-url').value = publicUrl;
      showToast('📸 Imagen lista para guardar', 'success');
    } catch (err) {
      console.error('Upload error:', err);
      showToast('❌ Error de subida (verifica el bucket "products")', 'error');
      // If upload fails, we keep the local preview but clear the hidden url field
      document.getElementById('prod-image-url').value = '';
    } finally {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
    }
  });

  // Save Category
  document.getElementById('btn-save-cat').addEventListener('click', async () => {
    const name = document.getElementById('new-cat-name').value.trim();
    if (!name) return;
    const { error } = await supabase.from('categories').insert({ name });
    if (error) showToast('Error al crear categoría', 'error');
    else {
      renderProductManager(container);
      showToast('📂 Categoría creada');
    }
  });

  // Save Product
  document.getElementById('btn-save-prod').addEventListener('click', async () => {
    const id = document.getElementById('prod-id').value;
    const btn = document.getElementById('btn-save-prod');

    const name = document.getElementById('prod-name').value;
    const price = document.getElementById('prod-price').value;
    const cost = document.getElementById('prod-cost').value;
    const category = document.getElementById('prod-category').value;
    const track_stock = document.getElementById('prod-track-stock').checked;
    const is_available = document.getElementById('prod-available').checked;
    const stock = document.getElementById('prod-stock').value;
    const image_url = document.getElementById('prod-image-url').value || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';
    const description = document.getElementById('prod-desc').value;

    if (!name || !price) return showToast('Nombre y Precio requeridos', 'error');

    btn.disabled = true;
    btn.innerText = 'GUARDANDO...';

    const productData = {
      name,
      category,
      image_url,
      description,
      cost: parseFloat(cost) || 0
    };

    const branchProductData = {
      price: parseFloat(price),
      track_stock,
      is_available,
      stock: parseInt(stock) || 0,
      branch_id: store.activeBranchId
    };

    let result;
    if (id) {
      result = await supabase.from('products').update(productData).eq('id', id).select().single();
    } else {
      result = await supabase.from('products').insert(productData).select().single();
    }

    if (result.error) {
       window.showToast('Error al guardar: ' + result.error.message, 'error');
       btn.disabled = false;
       btn.innerText = 'Guardar Producto';
       return;
    }

    // Update branch_products
    const prodId = result.data.id;
    const { error: branchError } = await supabase
      .from('branch_products')
      .upsert({
        product_id: prodId,
        branch_id: store.activeBranchId,
        ...branchProductData
      }, { onConflict: 'branch_id, product_id' });

    if (branchError) {
      window.showToast('Error al guardar datos de sucursal: ' + branchError.message, 'error');
    }
      // Save Recipe
      // 1. Delete old recipe
      await supabase.from('product_ingredients').delete().eq('product_id', prodId);
      // 2. Insert new recipe items
      const validRecipe = currentRecipe.filter(r => r.ingredient_id && r.quantity > 0);
      if (validRecipe.length > 0) {
        await supabase.from('product_ingredients').insert(
          validRecipe.map(r => ({ 
            product_id: prodId, 
            ingredient_id: r.ingredient_id, 
            quantity: r.quantity,
            usage_condition: r.usage_condition || 'always'
          }))
        );
      }

      window.showToast(id ? '✅ Producto actualizado' : '✨ Producto creado');
      formSection.classList.add('hidden');
      clearFormFields();
      currentRecipe = [];
      renderProductManager(container);
  });

  // Load and Render Recipe Tabs in Table
  const loadRecipePreviews = async () => {
    const { data: allRecipes } = await supabase.from('product_ingredients').select('*, ingredients(name, unit)');
    if (!allRecipes) return;

    products.forEach(p => {
      const pRecipe = allRecipes.filter(r => r.product_id === p.id);
      const previewEl = document.getElementById(`recipe-preview-${p.id}`);
      if (previewEl && pRecipe.length > 0) {
        previewEl.innerHTML = pRecipe.map(r => {
          const condition = r.usage_condition || 'always';
          const icon = conditionIcons[condition] || '♾️';
          return `
            <span class="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-lg text-[9px] font-black border border-orange-100 flex items-center gap-1" title="${condition}">
              ${icon} ${r.ingredients.name}: ${r.quantity}
            </span>
          `;
        }).join('');
      }
    });
  };
  loadRecipePreviews();

  // Global Actions
  window.editProduct = async (id) => {
    const { data: p } = await supabase.from('products').select('*').eq('id', id).single();
    const { data: bp } = await supabase.from('branch_products').select('*').eq('product_id', id).eq('branch_id', store.activeBranchId).maybeSingle();
    
    if (p) {
      document.getElementById('prod-id').value = p.id;
      document.getElementById('prod-name').value = p.name;
      // Use branch price if exists, else global
      document.getElementById('prod-price').value = bp ? bp.price : p.price;
      document.getElementById('prod-cost').value = p.cost;
      document.getElementById('prod-category').value = p.category || 'General';
      document.getElementById('prod-track-stock').checked = bp ? bp.track_stock : false;
      document.getElementById('prod-available').checked = bp ? bp.is_available : true;
      document.getElementById('prod-stock').value = bp ? bp.stock : 0;
      document.getElementById('prod-image-url').value = p.image_url;
      document.getElementById('prod-desc').value = p.description;

      const branch = store.branches.find(b => b.id === store.activeBranchId);
      document.getElementById('form-branch-tag').innerText = `Editando en: ${branch?.name || 'Sucursal Actual'}`;

      // Preview setup
      previewImg.src = p.image_url;
      previewImg.classList.remove('hidden');
      placeholder.classList.add('hidden');

      document.getElementById('form-title').innerText = 'Editando ' + p.name.toLowerCase();

      // Load current recipe
      const { data: rec } = await supabase.from('product_ingredients').select('*').eq('product_id', id);
      currentRecipe = rec || [];
      renderRecipeItems();

      catManager.classList.add('hidden');
      formSection.classList.remove('hidden');
      formSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  window.deleteCategory = async (id) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    await supabase.from('categories').delete().eq('id', id);
    renderProductManager(container);
  };

  window.toggleProductAvailability = async (id, newStatus) => {
    const { error } = await supabase
      .from('branch_products')
      .update({ is_available: newStatus })
      .eq('product_id', id)
      .eq('branch_id', store.activeBranchId);
    
    if (error) showToast('Error al actualizar disponibilidad', 'error');
    else {
      showToast(newStatus ? '✅ Producto disponible' : '🚫 Producto marcado como agotado');
      renderProductManager(container);
    }
  };

  window.deleteProduct = async (id) => {
    if (!confirm('¿Eliminar este plato del menú permanentemente?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      showToast('No se puede eliminar: tiene registros asociados', 'error');
    } else {
      showToast('🗑️ Plato eliminado');
      renderProductManager(container);
    }
  };
}

function clearFormFields() {
  const ids = ['prod-id', 'prod-name', 'prod-price', 'prod-cost', 'prod-stock', 'prod-image-url', 'prod-desc'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const trackStock = document.getElementById('prod-track-stock');
  const available = document.getElementById('prod-available');
  if (trackStock) trackStock.checked = false;
  if (available) available.checked = true;

  const preview = document.getElementById('prod-preview');
  const placeholder = document.getElementById('upload-placeholder');
  if (preview) preview.classList.add('hidden');
  if (placeholder) placeholder.classList.remove('hidden');
}

// Manual Stock Adjustments for Product Manager
window.openRefillModal = async (id) => {
  const { data: p } = await supabase.from('products').select('*').eq('id', id).single();
  const { data: bp } = await supabase.from('branch_products').select('*').eq('product_id', id).eq('branch_id', store.activeBranchId).maybeSingle();
  if (!p) return;
  const currentStock = bp ? bp.stock : 0;

  const modalHTML = `
        <div id="refill-modal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in text-gray-800">
            <div class="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl text-center">
                <div class="w-16 h-16 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">📈</div>
                <h3 class="text-2xl font-black tracking-tight capitalize mb-1">Reponer: ${p.name.toLowerCase()}</h3>
                <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest">Añadir existencias al inventario</p>
                
                <div class="my-8">
                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Unidades a añadir</p>
                    <input type="number" id="refill-qty" value="10" min="1" class="w-full text-center text-5xl font-black p-4 bg-gray-50 rounded-3xl border-2 border-transparent focus:border-green-500 focus:bg-white outline-none transition-all text-green-600">
                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Stock actual en sucursal: ${currentStock}</p>
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

    const { error } = await supabase
      .from('branch_products')
      .update({ stock: currentStock + qty })
      .eq('product_id', id)
      .eq('branch_id', store.activeBranchId);
    
    if (error) showToast('Error al actualizar', 'error');
    else {
      showToast('✅ Inventario actualizado');
      document.getElementById('refill-modal').remove();

      // Refresh logic
      if (window.setView) {
        window.setView('products');
      } else {
        const container = document.getElementById('page-content');
        if (container) renderProductManager(container);
      }
    }
  });
};

window.openWithdrawModal = async (id) => {
  const { data: p } = await supabase.from('products').select('*').eq('id', id).single();
  const { data: bp } = await supabase.from('branch_products').select('*').eq('product_id', id).eq('branch_id', store.activeBranchId).maybeSingle();
  if (!p) return;
  const currentStock = bp ? bp.stock : 0;

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
                        <input type="number" id="withdraw-qty" value="1" min="1" max="${currentStock}" class="w-full text-center text-4xl font-black p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-red-500 focus:bg-white outline-none transition-all text-red-500">
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
    const qtyString = document.getElementById('withdraw-qty').value;
    const qty = parseInt(qtyString);
    const reason = document.getElementById('withdraw-reason').value;

    if (isNaN(qty) || qty <= 0) return showToast('Cantidad no válida', 'error');
    if (qty > p.stock) return showToast('No puedes retirar más de lo que hay', 'error');

    const { error } = await supabase
      .from('branch_products')
      .update({ stock: currentStock - qty })
      .eq('product_id', id)
      .eq('branch_id', store.activeBranchId);

    if (error) showToast('Error al procesar salida', 'error');
    else {
      showToast(`📉 Salida registrada: -${qty} ${p.name}`);
      document.getElementById('withdraw-modal').remove();

      // Refresh logic
      if (window.setView) {
        window.setView('products');
      } else {
        const container = document.getElementById('page-content');
        if (container) renderProductManager(container);
      }
    }
  });
};

