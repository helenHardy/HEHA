import { supabase } from '../services/supabase.js';

export async function renderProductManager(container) {
  // 1. Fetch Products and Categories
  const { data: products } = await supabase.from('products').select('*').order('name');
  const { data: categories } = await supabase.from('categories').select('*').order('name');

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
          
          <h3 class="font-black text-2xl text-gray-800 tracking-tight mb-8" id="form-title">Agregar Producto</h3>
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
              
              <div>
                  <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 font-mono">Precio Venta (Bs)</label>
                  <div class="relative">
                     <span class="absolute left-6 top-1/2 -translate-y-1/2 font-black text-gray-300">Bs.</span>
                     <input type="number" id="prod-price" placeholder="0.00" step="0.5" class="w-full pl-14 pr-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none font-black text-xl text-primary">
                  </div>
              </div>

              <div>
                  <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 font-mono">Costo Producción (Bs)</label>
                  <div class="relative">
                     <span class="absolute left-6 top-1/2 -translate-y-1/2 font-black text-gray-300">Bs.</span>
                     <input type="number" id="prod-cost" placeholder="0.00" step="0.5" class="w-full pl-14 pr-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-blue-500/20 outline-none font-black text-xl text-blue-500">
                  </div>
              </div>
              
              <div class="col-span-2">
                   <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Categoría Relacionada</label>
                   <select id="prod-category" class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm appearance-none cursor-pointer">
                     ${categoryList.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                   </select>
              </div>

              <div class="col-span-2">
                   <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Descripción Corta</label>
                   <textarea id="prod-desc" placeholder="Detalles de los ingredientes o preparación..." class="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none font-medium text-sm scrollbar-hide" rows="3"></textarea>
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

      <!-- Products Grid/List -->
      <div class="grid grid-cols-1 gap-6">
        <div class="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
          <div class="overflow-x-auto scrollbar-hide">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-gray-50/50">
                  <th class="py-6 px-10 text-[10px] font-black text-gray-400 uppercase tracking-widest">Plato</th>
                  <th class="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Categoría</th>
                  <th class="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Costo</th>
                  <th class="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Precio</th>
                  <th class="py-6 px-10 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                ${products ? products.map(p => `
                  <tr class="group hover:bg-gray-50/50 transition-colors">
                    <td class="py-6 px-10">
                      <div class="flex items-center gap-6">
                        <div class="h-16 w-16 rounded-2xl bg-gray-50 overflow-hidden flex-shrink-0 shadow-sm border border-gray-100 group-hover:scale-105 transition duration-500">
                          <img src="${p.image_url}" class="h-full w-full object-cover" onerror="this.src='https://placehold.co/100x100?text=${p.name[0]}'">
                        </div>
                        <div>
                           <p class="font-black text-gray-800 text-lg capitalize leading-tight">${p.name.toLowerCase()}</p>
                           <p class="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest truncate w-40">${p.description || 'Sin descripción'}</p>
                        </div>
                      </div>
                    </td>
                    <td class="py-6 px-4">
                        <span class="bg-blue-50 text-blue-500 text-[9px] font-black px-3 py-1.5 rounded-xl border border-blue-100 uppercase tracking-widest">${p.category || 'General'}</span>
                    </td>
                    <td class="py-6 px-4 text-right">
                       <p class="font-bold text-xs text-gray-400 font-mono">Bs. ${p.cost.toFixed(2)}</p>
                    </td>
                    <td class="py-6 px-4 text-right">
                       <div class="flex flex-col items-end">
                          <p class="font-black text-gray-800 text-lg tabular-nums">Bs. ${p.price.toFixed(2)}</p>
                          <span class="text-[9px] font-black text-green-500 uppercase tracking-tighter">Profit Bs. ${(p.price - (p.cost || 0)).toFixed(2)}</span>
                       </div>
                    </td>
                    <td class="py-6 px-10 text-right">
                      <div class="flex justify-end gap-2">
                        <button class="w-10 h-10 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-blue-500 hover:shadow-md transition active:scale-90" onclick="window.editProduct(${p.id})">
                           ✏️
                        </button>
                        <button class="w-10 h-10 flex items-center justify-center bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-red-500 hover:shadow-md transition active:scale-90" onclick="window.deleteProduct(${p.id})">
                           🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('') : '<tr><td colspan="5" class="py-40 text-center text-gray-300 font-black uppercase tracking-widest text-xs">No hay productos en el menú</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

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
    document.getElementById('form-title').innerText = 'Nuevo Plato en el Menú';
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
    const image_url = document.getElementById('prod-image-url').value || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';
    const description = document.getElementById('prod-desc').value;

    if (!name || !price) return showToast('Nombre y Precio requeridos', 'error');

    btn.disabled = true;
    btn.innerText = 'GUARDANDO...';

    const productData = {
      name,
      price: parseFloat(price),
      cost: parseFloat(cost) || 0,
      category,
      image_url,
      description
    };

    let result;
    if (id) {
      result = await supabase.from('products').update(productData).eq('id', id);
    } else {
      result = await supabase.from('products').insert(productData);
    }

    if (result.error) {
      showToast('Error al guardar: ' + result.error.message, 'error');
      btn.disabled = false;
      btn.innerText = 'Guardar Producto';
    } else {
      showToast(id ? '✅ Producto actualizado' : '✨ Producto creado');
      formSection.classList.add('hidden');
      clearFormFields();
      renderProductManager(container);
    }
  });

  // Global Actions
  window.editProduct = async (id) => {
    const { data: p } = await supabase.from('products').select('*').eq('id', id).single();
    if (p) {
      document.getElementById('prod-id').value = p.id;
      document.getElementById('prod-name').value = p.name;
      document.getElementById('prod-price').value = p.price;
      document.getElementById('prod-cost').value = p.cost;
      document.getElementById('prod-category').value = p.category || 'General';
      document.getElementById('prod-image-url').value = p.image_url;
      document.getElementById('prod-desc').value = p.description;

      // Preview setup
      previewImg.src = p.image_url;
      previewImg.classList.remove('hidden');
      placeholder.classList.add('hidden');

      document.getElementById('form-title').innerText = 'Editando ' + p.name.toLowerCase();
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
  const ids = ['prod-id', 'prod-name', 'prod-price', 'prod-cost', 'prod-image-url', 'prod-desc'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const preview = document.getElementById('prod-preview');
  const placeholder = document.getElementById('upload-placeholder');
  if (preview) preview.classList.add('hidden');
  if (placeholder) placeholder.classList.remove('hidden');
}
