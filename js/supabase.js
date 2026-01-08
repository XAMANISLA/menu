// Configuración de Supabase
const SUPABASE_URL = 'https://pngchqduvpbuvczdnzvy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_t_UBMJBd73W-CEBVHmpUzg_VRpfPVmr';

// Inicializar el cliente de Supabase
// Usamos el objeto global 'supabase' cargado desde el CDN
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Exportar para usar en otros archivos
window.supabase = supabaseClient;
