// Estado global de la aplicación
let productos = [];
let categorias = [];
let carrito = [];
let mesaActual = localStorage.getItem('mesa_actual');
let mesaNombre = localStorage.getItem('mesa_nombre') || `Mesa ${mesaActual}`;
let searchQuery = '';
let categoriaActual = 'Todos';

// Elementos del DOM
const productGrid = document.getElementById('product-grid');
const categoriesContainer = document.getElementById('categories-container');
const cartModal = document.getElementById('cart-modal');
const cartPanel = document.getElementById('cart-panel');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const cartCountElement = document.getElementById('cart-count');
const toast = document.getElementById('toast');
const labelMesa = document.getElementById('label-mesa');
const searchInput = document.getElementById('search-input');

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    if (!mesaActual) {
        window.location.href = 'index.html';
        return;
    }
    labelMesa.innerText = mesaNombre;

    // Actualizar título del carrito con la mesa
    const cartTitle = document.getElementById('cart-title');
    if (cartTitle) {
        cartTitle.innerText = `Tu Pedido - ${mesaNombre}`;
    }

    await cargarProductos();
    renderizarCategorias();
    renderizarProductos();

    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('btn-cart').addEventListener('click', toggleCart);
    document.getElementById('close-cart').addEventListener('click', toggleCart);
    document.getElementById('cart-overlay').addEventListener('click', toggleCart);
    document.getElementById('send-order').addEventListener('click', enviarPedido);

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            renderizarProductos();
        });
    }
}

// Cargar productos desde Supabase
async function cargarProductos() {
    try {
        const { data, error } = await window.supabase
            .from('productos')
            .select('*')
            .eq('activo', true);

        if (error) throw error;

        productos = data;
        categorias = ['Todos', ...new Set(productos.map(p => p.categoria))];
    } catch (error) {
        console.error('Error al cargar productos:', error);
        showToast('Error al conectar con la base de datos');
    }
}

function renderizarCategorias() {
    categoriesContainer.innerHTML = '';
    categorias.forEach(cat => {
        const pill = document.createElement('button');
        pill.className = `category-pill px-6 py-2 rounded-full whitespace-nowrap font-semibold text-sm transition-all border border-gray-200 bg-white text-gray-600 hover:border-[#2d5a27]/50 ${cat === 'Todos' ? 'active' : ''}`;
        pill.innerText = cat;
        pill.onclick = () => filterByCategory(cat, pill);
        categoriesContainer.appendChild(pill);
    });
}

function filterByCategory(categoria, element) {
    document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
    categoriaActual = categoria;
    renderizarProductos();
}

function renderizarProductos() {
    productGrid.innerHTML = '';

    let filtered = categoriaActual === 'Todos'
        ? productos
        : productos.filter(p => p.categoria === categoriaActual);

    // Filtro por buscador (si el nombre empieza con lo que se escribió)
    if (searchQuery) {
        filtered = filtered.filter(p =>
            p.nombre.toLowerCase().startsWith(searchQuery) ||
            p.nombre.toLowerCase().includes(searchQuery) // Incluimos includes para mayor flexibilidad, pero startsWith prioriza
        ).sort((a, b) => {
            const aStarts = a.nombre.toLowerCase().startsWith(searchQuery);
            const bStarts = b.nombre.toLowerCase().startsWith(searchQuery);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return 0;
        });
    }

    filtered.forEach(producto => {
        const card = document.createElement('div');
        card.className = "bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 group";
        card.innerHTML = `
            <div class="relative h-48 overflow-hidden">
                <img src="${producto.imagen || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}" 
                     alt="${producto.nombre}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                <div class="absolute top-4 right-4">
                    <span class="bg-[#588157] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm border border-white/20">
                        ${producto.categoria}
                    </span>
                </div>
            </div>
            <div class="p-5">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-lg font-bold text-gray-800">${producto.nombre}</h3>
                    <span class="text-xl font-black text-[#588157]">$${producto.precio.toFixed(2)}</span>
                </div>
                <p class="text-gray-500 text-sm mb-4 line-clamp-2">${producto.descripcion || 'Sin descripción disponible.'}</p>
                <button onclick="agregarAlCarrito('${producto.id}')" 
                    class="bg-[#3a5a40] hover:bg-[#588157] text-white text-xs font-black px-5 py-3 rounded-xl transition-all shadow-lg active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2 group">
                    <i class="fas fa-plus text-xs"></i>
                    <span>Agregar al Pedido</span>
                </button>
            </div>
        `;
        productGrid.appendChild(card);
    });
}

// Lógica del Carrito
function agregarAlCarrito(id) {
    const producto = productos.find(p => p.id === id);
    const existing = carrito.find(item => item.id === id);

    if (existing) {
        existing.cantidad++;
    } else {
        carrito.push({ ...producto, cantidad: 1, observaciones: '' });
    }

    actualizarCarritoUI();
    showToast(`${producto.nombre} agregado`);
}

function actualizarCarritoUI() {
    cartCountElement.innerText = carrito.reduce((acc, item) => acc + item.cantidad, 0);
    cartItemsContainer.innerHTML = '';

    let total = 0;

    carrito.forEach((item, index) => {
        total += item.precio * item.cantidad;
        const div = document.createElement('div');
        div.className = "flex flex-col gap-3 pb-6 border-b border-gray-100 last:border-0";
        div.innerHTML = `
            <div class="flex gap-4">
                <img src="${item.imagen || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'}" 
                     class="w-20 h-20 rounded-2xl object-cover">
                <div class="flex-1">
                    <div class="flex justify-between items-start">
                        <h4 class="font-bold text-gray-800 leading-tight">${item.nombre}</h4>
                        <button onclick="removerDelCarrito(${index})" class="text-gray-300 hover:text-red-500">
                            <i class="fas fa-trash-can"></i>
                        </button>
                    </div>
                    <p class="text-[10px] font-black text-[#84a98c] mt-1 uppercase tracking-tighter">$${item.precio.toFixed(2)}</p>
                    <div class="flex items-center gap-4 mt-2">
                        <div class="flex items-center gap-3 bg-gray-100 px-3 py-1 rounded-full">
                            <button onclick="actualizarCantidad(${index}, -1)" class="text-gray-500 hover:text-[#2d5a27]"><i class="fas fa-minus text-xs"></i></button>
                            <span class="font-bold text-gray-800 w-4 text-center">${item.cantidad}</span>
                            <button onclick="actualizarCantidad(${index}, 1)" class="text-gray-500 hover:text-[#2d5a27]"><i class="fas fa-plus text-xs"></i></button>
                        </div>
                    </div>
                </div>
            </div>
            <div>
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Instrucciones Especiales</p>
                <input type="text" placeholder="Notas: ej. sin cebolla..." 
                    value="${item.observaciones}"
                    onchange="actualizarNotas(${index}, this.value)"
                    class="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-[#84a98c] outline-none transition-all italic">
            </div>
        `;
        cartItemsContainer.appendChild(div);
    });

    cartTotalElement.innerText = `$${total.toFixed(2)}`;
}

function actualizarCantidad(index, delta) {
    carrito[index].cantidad += delta;
    if (carrito[index].cantidad <= 0) {
        carrito.splice(index, 1);
    }
    actualizarCarritoUI();
}

function actualizarNotas(index, valor) {
    carrito[index].observaciones = valor;
}

function removerDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarCarritoUI();
}

function toggleCart() {
    const isVisible = !cartModal.classList.contains('invisible');
    if (isVisible) {
        cartPanel.classList.add('translate-x-full');
        setTimeout(() => {
            cartModal.classList.add('invisible', 'opacity-0');
        }, 300);
    } else {
        cartModal.classList.remove('invisible', 'opacity-0');
        setTimeout(() => {
            cartPanel.classList.remove('translate-x-full');
        }, 10);
    }
}

// Finalizar Pedido
async function enviarPedido() {
    if (carrito.length === 0) {
        showToast('El carrito está vacío');
        return;
    }

    const btn = document.getElementById('send-order');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch animate-spin"></i> <span>Enviando...</span>';

    try {
        // 1. Obtener ID de la mesa
        let { data: mesaData, error: mesaError } = await window.supabase
            .from('mesas')
            .select('id')
            .eq('numero', mesaActual)
            .single();

        if (mesaError || !mesaData) {
            // Si la mesa no existe, la creamos (o podrías manejarlo como error)
            const { data: newMesa, error: createError } = await window.supabase
                .from('mesas')
                .insert({ numero: mesaActual, estado: 'abierta' })
                .select()
                .single();

            if (createError) throw createError;
            mesaData = newMesa;
        } else {
            // Asegurar que la mesa esté abierta
            await window.supabase.from('mesas').update({ estado: 'abierta' }).eq('id', mesaData.id);
        }

        // 2. Crear cabecera del pedido
        const total = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
        const { data: pedido, error: pedidoError } = await window.supabase
            .from('pedidos')
            .insert({
                mesa_id: mesaData.id,
                total: total,
                estado_cocina: 'enviado',
                estado_barra: 'enviado'
            })
            .select()
            .single();

        if (pedidoError) throw pedidoError;

        // 3. Crear detalles
        const detalles = carrito.map(item => ({
            pedido_id: pedido.id,
            producto_id: item.id,
            cantidad: item.cantidad,
            observaciones: item.observaciones,
            subtotal: item.precio * item.cantidad
        }));

        const { error: detalleError } = await window.supabase
            .from('pedido_detalle')
            .insert(detalles);

        if (detalleError) throw detalleError;

        // Éxito
        showToast('¡Pedido enviado con éxito!');
        carrito = [];
        actualizarCarritoUI();
        toggleCart();
    } catch (error) {
        console.error('Error al enviar pedido:', error);
        showToast('Error al procesar el pedido');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> <span>Confirmar Pedido</span>';
    }
}

function showToast(mensaje) {
    toast.innerText = mensaje;
    toast.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
}
