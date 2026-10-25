import Link from 'next/link';
const lessons = [
  { id:'staging', title:'ステージと作業ツリーを分ける', task:'app.txtをstageと書いた内容へ編集し、addします。その後workingへ再編集してからcommitし、記録した内容と残った差を確認します。', solution:'printf "stage\\n" > app.txt\ngit add app.txt\nprintf "working\\n" > app.txt\ngit commit -m "Record staged content"\ngit show HEAD:app.txt\ngit diff' },
  { id:'merge', title:'異なる行の変更を統合', task:'mainとfeatureが同じファイルの離れた行を変更済みです。両方の変更を残すマージコミットを作ります。', solution:'git switch main\ngit merge feature -m "Merge feature"\ngit log --graph --oneline\ncat app.txt' },
  { id:'restore', title:'未追跡ファイルを残して取り消す', task:'app.txtの未stage変更だけを取り消し、notes.txtは残してください。', solution:'git diff\ngit restore app.txt\ngit status\ncat notes.txt' },
  { id:'recovery', title:'reflogから救出', task:'reset前のRescue this commitを探し、そのコミットを指すrescueブランチを作ります。', solution:'git reflog\ngit branch rescue <見つけたコミットID>\ngit show rescue:rescue.txt' },
];
export default function RealGit() {
  return <main className="min-h-screen bg-gray-950 text-gray-100 p-6"><div className="max-w-3xl mx-auto space-y-6"><h1 className="text-2xl font-bold">自分のPCの実Gitで練習する</h1><Link href="/game" tabIndex={0} className="inline-block min-h-11 text-blue-200 underline">ブラウザ演習へ戻る</Link>
    <p>GitとNode.jsを用意し、このリポジトリをクローンしてnpm ciを実行します。以下のsetupはOSの一時フォルダ内に新しい練習リポジトリを作ります。既存の作業リポジトリは変更せず、実GitHubや認証情報にも接続しません。</p>
    <pre className="overflow-auto rounded bg-gray-900 p-3">git clone https://github.com/jinxin4869/git_study_app.git{'\n'}cd git_study_app{'\n'}npm ci</pre>
    <p>setupの出力したパスへ移動し、その練習ディレクトリ内で課題に取り組みます。検証は元のプロジェクトディレクトリから実行します。解答例はmacOS/Linux/Git Bash向けです。PowerShellでは同じ内容をエディタで編集できます。</p>
    {lessons.map(lesson => <section key={lesson.id} className="border border-gray-700 rounded p-4 space-y-3"><h2 className="font-bold text-xl">{lesson.title}</h2><p>{lesson.task}</p><pre className="overflow-auto">npm run lab -- setup {lesson.id}</pre><details><summary tabIndex={0} className="min-h-11 cursor-pointer">解答例と確認</summary><pre className="whitespace-pre-wrap break-all">{lesson.solution}</pre></details><p>プロジェクトへ戻って検証:</p><pre className="overflow-auto">npm run lab -- verify &lt;setupが出力したパス&gt;</pre></section>)}
    <p>未コミット変更はreflogの復元対象ではありません。不要になった練習フォルダは、内容と場所を確認してから手動で削除できます。自動削除は行いません。</p></div></main>;
}
