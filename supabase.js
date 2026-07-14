// Supabase 프로젝트 접속 정보 (본인의 프로젝트 값으로 교체하세요)
const SUPABASE_URL = 'https://wtyralabvgrxxedhqrfj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zHbnogYy1cf7Nksso92mgA_phtXZd3p';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
