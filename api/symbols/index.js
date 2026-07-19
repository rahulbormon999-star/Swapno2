// ── সব ক্যাটেগরির প্রতীক একসাথে + matching helper ─────────────
import { BIRDS } from './birds.js';
import { ANIMALS } from './animals.js';
import { HUMAN_ISSUES } from './human-issues.js';
import { DIVINE_BEINGS } from './divine-beings.js';
import { VEHICLES } from './vehicles.js';
import { ACTION_SEMANTICS } from './action-semantics.js';

export const ALL_SYMBOLS = [...BIRDS, ...ANIMALS, ...HUMAN_ISSUES, ...DIVINE_BEINGS, ...VEHICLES];
export { ACTION_SEMANTICS };

// dream টেক্সট থেকে match হওয়া প্রতীকগুলো খুঁজে বের করে (সহজ keyword matching)
export function findMatchedSymbols(dreamText) {
    const text = dreamText.toLowerCase();
    const matched = [];

    for (const entry of ALL_SYMBOLS) {
        const namesToCheck = [entry.symbol, ...(entry.aliases || [])];
        const isMatch = namesToCheck.some(name => name && text.includes(name.toLowerCase()));
        if (isMatch) matched.push(entry);
    }
    return matched;
}

// matched প্রতীকগুলো থেকে Groq prompt-এ পাঠানোর জন্য একটা readable context block বানায়
// dreamText দিয়ে ফিল্টার করা হয় যাতে শুধু প্রাসঙ্গিক action-semantics পাঠানো হয় (টোকেন বাঁচাতে)
export function buildContextBlock(matchedSymbols, dreamText = '') {
    if (!matchedSymbols.length) return '';

    const lines = matchedSymbols.map(s => {
        let line = `- ${s.symbol} (polarity: ${s.polarity}): ${s.core_meaning}`;
        if (s.companion_animal) {
            line += `\n  সংশ্লিষ্ট সঙ্গী-প্রতীক — ${s.companion_animal.symbol}: ${s.companion_animal.meaning}`;
        }
        if (s.modifiers) {
            const modLines = Object.entries(s.modifiers)
                .map(([k, v]) => `  • ${k}: ${v}`).join('\n');
            line += `\n  সম্ভাব্য variant:\n${modLines}`;
        }
        return line;
    });

    // শুধু dreamText-এ keyword মিলে যাওয়া action-গুলোই ফিল্টার করে নেওয়া হচ্ছে (টোকেন বাঁচাতে)
    const text = dreamText.toLowerCase();
    const relevantActions = ACTION_SEMANTICS.filter(a =>
        a.keywords.some(k => text.includes(k.toLowerCase()))
    );

    const actionLines = relevantActions
        .map(a => `- "${a.label}" → positive প্রতীকে: ${a.positive} | negative প্রতীকে: ${a.negative} | neutral প্রতীকে: ${a.neutral}`)
        .join('\n');

    const actionSection = relevantActions.length > 0
        ? `\nসাধারণ action-অর্থ নির্দেশিকা (প্রতীকের polarity অনুযায়ী প্রয়োগ করো):\n${actionLines}\n`
        : '';

    return `নিচে ইউজারের স্বপ্নে পাওয়া প্রতীকের রেফারেন্স তথ্য দেওয়া হলো (নিজের ভাষায় ব্যবহার করো, হুবহু কপি না করে):

মিলে যাওয়া প্রতীক:
${lines.join('\n')}
${actionSection}`;
}
