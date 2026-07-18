// ── সব ক্যাটেগরির প্রতীক একসাথে + matching helper ─────────────
import { BIRDS } from './birds.js';
import { ANIMALS } from './animals.js';
import { HUMAN_ISSUES } from './human_issues.js';
import { DIVINE_BEINGS } from './divine_beings.js';
import { ACTION_SEMANTICS } from './action_semantics.js';

export const ALL_SYMBOLS = [...BIRDS, ...ANIMALS, ...HUMAN_ISSUES, ...DIVINE_BEINGS];
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
export function buildContextBlock(matchedSymbols) {
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

    const actionLines = Object.entries(ACTION_SEMANTICS)
        .map(([action, meanings]) =>
            `- "${action}" → positive প্রতীকে: ${meanings.positive} | negative প্রতীকে: ${meanings.negative} | neutral প্রতীকে: ${meanings.neutral}`
        ).join('\n');

    return `নিচে ইউজারের স্বপ্নে পাওয়া প্রতীকের রেফারেন্স তথ্য দেওয়া হলো (নিজের ভাষায় ব্যবহার করো, হুবহু কপি না করে):

মিলে যাওয়া প্রতীক:
${lines.join('\n')}

সাধারণ action-অর্থ নির্দেশিকা (প্রতীকের polarity অনুযায়ী প্রয়োগ করো, প্রাসঙ্গিক হলেই ব্যবহার করো):
${actionLines}
`;
                                                                              }
