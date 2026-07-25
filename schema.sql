-- ══════════════════════════════════════════════════════════
-- Dream Lans — সম্পূর্ণ Neon (Postgres) স্কিমা
-- Neon dashboard → SQL Editor-এ পুরোটা পেস্ট করে একবারে রান করুন
-- ══════════════════════════════════════════════════════════

-- ১. ইউজার (Dev-Onix SSO থেকে আসা তথ্য + অ্যাপ-নিজস্ব তথ্য)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    dev_onix_user_id TEXT UNIQUE NOT NULL,   -- Dev-Onix-এর user id (দুই সাইট sync রাখার চাবি)
    name TEXT,
    phone TEXT,
    email TEXT,
    dob DATE,
    gender TEXT,                              -- 'male' / 'female' / 'other' / null
    picture TEXT,
    country TEXT,
    profession TEXT,                          -- Dream Lans নিজে conversation থেকে শিখে নেবে
    created_at TIMESTAMPTZ DEFAULT now(),
    last_seen TIMESTAMPTZ DEFAULT now()
);

-- ২. প্রতীক ডেটাবেজ (animals.js, birds.js ইত্যাদির পাশাপাশি — admin থেকে যোগ হওয়া নতুন প্রতীক এখানে যাবে)
CREATE TABLE IF NOT EXISTS symbols (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,                   -- 'animal' | 'bird' | 'divine_being' | 'vehicle' | 'human_issue' | ...
    symbol TEXT NOT NULL,
    aliases TEXT[] DEFAULT '{}',
    core_meaning TEXT NOT NULL,
    polarity TEXT DEFAULT 'neutral',           -- positive | negative | neutral
    modifiers JSONB,
    companion_animal JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ৩. Action-semantics (সার্বজনীন ক্রিয়া-অর্থ টেবিল)
CREATE TABLE IF NOT EXISTS action_semantics (
    id SERIAL PRIMARY KEY,
    label TEXT NOT NULL,
    keywords TEXT[] NOT NULL,
    positive_meaning TEXT,
    negative_meaning TEXT,
    neutral_meaning TEXT
);

-- ৪. কথোপকথন লগ (analytics + admin review)
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),      -- null হতে পারে (লগইন না করা ইউজারের জন্য)
    session_id TEXT,
    dream_text TEXT NOT NULL,
    ai_response TEXT,
    input_type TEXT,                            -- 'new_dream' | 'context_answer' | 'general_question'
    matched_symbols TEXT[],
    model_used TEXT,                             -- 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant'
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    ip_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ৫. যেসব প্রতীক ডাটাবেজে match হয়নি (admin-এর জন্য সবচেয়ে গুরুত্বপূর্ণ টেবিল)
CREATE TABLE IF NOT EXISTS unmatched_queries (
    id SERIAL PRIMARY KEY,
    dream_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed BOOLEAN DEFAULT false
);

-- ৬. ফিডব্যাক (👍/👎)
CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    rating TEXT,                                  -- 'up' | 'down'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ৭. Admin login (শুধু আপনার জন্য, Dev-Onix থেকে আলাদা)
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- দ্রুত query-এর জন্য index
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_symbols_category ON symbols(category);
CREATE INDEX IF NOT EXISTS idx_unmatched_reviewed ON unmatched_queries(reviewed);
