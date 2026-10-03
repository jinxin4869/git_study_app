import { Scenario } from '@/types/git';
import { lessonNotes } from './lesson-notes';

export function lessonHints(scenario: Scenario) {
  const note = lessonNotes[scenario.id];
  if (!note) throw new Error(`演習 ${scenario.id} の教材が未定義です。`);
  const commands = [...new Set((scenario.solution ?? []).map(command => {
    const words = command.trim().split(/\s+/);
    return ['git', 'gh', 'simulate'].includes(words[0]) ? words.slice(0, words[0] === 'gh' ? 3 : 2).join(' ') : words[0];
  }))];
  return [
    { title: '考え方', text: note.concept },
    { title: '確認方法', text: note.verify },
    { title: 'コマンド', text: `使える操作の候補: ${commands.join('、')}。対象やオプションは達成条件に合わせて選びます。` },
    { title: '解答例', text: (scenario.solution ?? []).join('\n') }
  ];
}
