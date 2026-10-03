import { Scenario } from '@/types/git';

const concepts: Partial<Record<Scenario['goal']['type'], string>> = {
  repo_initialized: 'バージョン管理を始めるには、まずリポジトリを準備します。',
  file_exists: 'Gitに記録する前に、作業ツリーに対象のファイルが必要です。',
  file_staged: '作業ツリーを編集しただけでは、次のコミットに入りません。indexに記録する内容を選びます。',
  file_modified: '作業ツリーと、最後にコミットした内容は別のものです。',
  file_committed: '作業ツリー、index、履歴の順に変更を記録します。',
  file_missing: '作業ツリーからの削除と、履歴からの削除は別の操作です。',
  branch_exists: 'ブランチはコミットへの参照です。参照を作ることと移動することを区別します。',
  merge_complete: '統合先へ移動してから、別の履歴を取り込みます。競合があれば内容を決めてから記録します。',
  clean_working_tree: '変更が作業ツリーとindexのどこに残っているか確認し、必要な変更を保管します。',
  stash_count: '履歴に確定する前の作業を、一時的に退避できます。',
  conflict_present: '同じ内容への異なる変更を取り込むと、人が結果を選ぶ必要があります。',
  conflict_resolved: 'マーカーを消すだけでなく、課題で必要な内容を保つことが大切です。',
  github_state: 'PR・レビュー・CIは模擬操作です。承認とチェックが最新の公開コミットに対応しているか確認します。',
  commit_count: '履歴はコミットの親をたどって確認できます。必要な変更をindexで選んでから記録します。',
  command_executed: 'この課題は状態や履歴を調べる操作を練習します。出力を読んで、何を確認できるか考えましょう。'
};
const categoryConcepts: Record<string, string> = {
  '履歴整理・対話的rebase': '履歴を整理するとコミットの親や内容が変わります。残す変更と順序を先に考えます。',
  '競合の継続・中断': '操作を進める場合と、元の状態に戻す場合を区別します。必要な内容を失わないよう確認します。',
  'リモート・チーム開発': '手元の参照、追跡参照、模擬サーバーの参照は別です。どこに変更を反映するか考えます。',
  '並行作業・特殊構成': '作業場所や対象ファイルの設定と、コミットされた内容を区別します。',
  '不具合の調査': '正常・異常の境界を履歴から絞り込みます。調査終了後は元の作業場所へ戻します。'
};
export function lessonHints(scenario: Scenario) {
  const commands = [...new Set((scenario.solution ?? []).map(command => {
    const words = command.trim().split(/\s+/);
    return ['git', 'gh', 'simulate'].includes(words[0]) ? words.slice(0, words[0] === 'gh' ? 3 : 2).join(' ') : words[0];
  }))];
  return [
    { title: '考え方', text: concepts[scenario.goal.type] ?? categoryConcepts[scenario.category ?? ''] ?? '達成条件を、作業ツリー・index・参照・履歴に分けて考えます。どの場所を変える必要があるか確認しましょう。' },
    { title: '確認方法', text: '画面の達成条件で「未達」の項目を探し、ファイル一覧・プレビュー・コミットグラフ・端末の結果と照らし合わせます。途中の操作では状態案内も確認しましょう。' },
    { title: 'コマンド', text: `使える操作の候補: ${commands.join('、')}。対象やオプションは達成条件に合わせて選びます。` },
    { title: '解答例', text: (scenario.solution ?? []).join('\n') }
  ];
}
