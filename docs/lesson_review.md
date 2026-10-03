# 139演習の教材・採点レビュー

基点a94b380の既存139件を維持。各演習の説明・初期状態・goal・hints・solutionを照合し、課題別の考え方/確認/注意を執筆した。以下は課題ごとに、何を確認するかと模擬範囲/実務注意を残した編集記録。合否はgoal-checkerの共通述語であり、本文の文言だけで判定しない。

自動検証は全139件の初期状態・解答の各ステップ・失敗コマンドと条件/判定一致、notesと推奨順のID一致を実行する。具体的な誤採点13経路と検証済み別解7経路はlesson-review.test.tsを参照。任意の誤操作列や全Git別解を網羅したとはしない。

| 演習ID | 現在の目標種別・条件キー | 個別の確認方法 | 注意・模擬範囲 |
| --- | --- | --- | --- |
| level-1-1 | repo_initialized:  | 初期化の成功メッセージと、まだコミットがないことを確認します。 | 実Gitはディスクに.gitを作ります。このアプリはブラウザ内の状態を初期化します。 |
| level-1-2 | file_exists: name | ファイル一覧でREADME.mdの存在を、statusで未追跡の表示を確認します。 | 空ファイルも管理できます。touchとechoは、このアプリで使える簡易ファイル操作です。 |
| level-1-3 | command_executed: command | README.mdがUntracked filesにあることを読みます。 | この演習はstatusの実行を採点します。出力を理解したかの自動判定は行いません。 |
| level-1-4 | file_staged: name | statusでステージ済みになり、indexとHEADに差があることを確認します。 | add .は他の変更も含めます。実務では対象ファイルと差分を確認してから記録します。 |
| level-1-5 | state_matches: commitCount, committedFiles | logに最初のコミットが現れ、README.mdが記録されていることを確認します。 | メッセージだけを入力しても、必要な内容がindexになければ記録できません。 |
| level-1-6 | command_executed: command | コミットID、メッセージ、親子の順を読み、最初のコミットを確認します。 | この演習は確認操作を採点します。作者や日時は模擬情報です。 |
| level-1-7 | file_modified: name | プレビューとdiffでREADME.mdの変更を確認します。 | echoの > は上書きです。実シェルの追記 >> はこのアプリでは未対応です。touchは既存ファイルの内容を変更しません。 |
| level-1-8 | command_executed: command | README.mdの削除行と追加行を読みます。 | ステージ後の内容を見るときはdiff --stagedを使います。この課題は未ステージ差分を調べます。 |
| level-1-9 | state_matches: commitCount, tree | logの親子と、HEADのREADME.mdが作業内容と一致することを確認します。 | 前回のaddは、その時点の内容を選びます。後の編集まで自動でコミットされません。 |
| level-1-10 | file_committed: name | 作業ファイルの存在だけでなく、HEADのコミットにapp.tsがあることを確認します。 | 別のファイルをコミットしても、この課題の対象を記録したことにはなりません。 |
| level-2-1 | branch_exists: name | グラフでfeatureという参照が現れることを確認します。 | 作成だけの操作と、作成して移動する操作の両方を利用できます。 |
| level-2-2 | branch_exists: name, checkedOut | グラフのfeatureにHEADが付いていることを確認します。 | 実務では切り替え前にstatusを確認し、移動先と衝突する未記録変更を保護します。 |
| level-2-3 | state_matches: branch, workingPresent | featureにHEADがあり、feature.txtが作業ツリーにあることを確認します。 | mainへ移動してファイルを作ると、指定した作業場所での練習になりません。 |
| level-2-4 | state_matches: commitCount, branch, committedFiles, branches | feature側のHEADにfeature.txtがあり、mainの参照が元の位置にあることを確認します。 | 関係のないファイルのコミットやmainでのコミットでは、この目的を満たしません。 |
| level-2-5 | branch_exists: name, checkedOut | HEADがmainへ移り、feature側の履歴は残っていることを確認します。 | ブランチの移動はfeatureのコミットを削除する操作ではありません。 |
| level-2-6 | command_executed: command | 一覧を読み、mainにはfeature.txtがないことを確認します。 | この演習ではファイル一覧を確認する操作を採点します。各演習の初期状態は独立しています。 |
| level-2-7 | state_matches: branch, workingPresent | HEADがmainで、main.txtが作業ツリーにあることを確認します。 | 作成したファイルはまだ未追跡です。次のコミットへ含めるにはステージが必要です。 |
| level-2-8 | state_matches: commitCount, branch, committedFiles, branches | mainの最新コミットにmain.txtがあり、featureの参照を保持していることを確認します。 | コミット数だけでなく、記録した対象と作業ブランチを確認します。 |
| level-2-9 | command_executed: command | グラフのmainとfeatureの位置、共通の親を読みます。 | 通常のlogは現在のHEAD側をたどります。全ブランチ表示では--allを使います。 |
| level-3-1 | branch_exists: name, checkedOut | HEADがmainにあることを確認します。 | 逆のブランチでmergeすると統合先が変わります。ブランチ名と作業内容を確認します。 |
| level-3-2 | merge_complete: branch, mergedCommit | mainの参照がfeatureと同じc2へ進んだことを確認します。 | fast-forwardでは新しい二親のコミットは作りません。分岐した履歴とは異なります。 |
| level-3-3 | state_matches: commitCount, branch, committedFiles, branches | HEADがfeature2で、feature2.txtがそのコミットにあることを確認します。 | mainに同じ変更を記録すると、この課題で準備する分岐の形になりません。 |
| level-3-4 | state_matches: branch, tree, message | main-update.txtとメッセージUpdate main、HEADがmainであることを確認します。 | この課題は指定メッセージも採点します。実務のメッセージは変更目的を説明します。 |
| level-3-5 | state_matches: branch, parents, tree | mainの最新コミットの二つの親と、双方のファイル内容を確認します。 | 別のブランチとの二親コミットを作っただけでは、feature2の統合にはなりません。 |
| level-4-1 | command_executed: command | statusでREADME.mdの未記録変更を読みます。 | stashが必要かを判断するため、まず対象と変更範囲を確認します。 |
| level-4-2 | state_matches: clean, stashCount | statusで追跡ファイルがクリーンになり、stash listに一件あることを確認します。 | 通常のstashは未追跡ファイルを含みません。必要な場合は-uを検討します。 |
| level-4-3 | command_executed: command | stash@{0}が最新の保管であることを確認します。 | 一覧の番号は削除や追加で変わります。実務では適用前に内容も確認します。 |
| level-4-4 | file_modified: name | プレビューとdiffでREADME.mdの編集が戻ったことを確認します。 | applyは保管を残し、成功したpopは消します。この演習は復元した内容を採点します。 |
| level-5-1 | command_executed: command | logで最新コミットと一つ前のコミットを読みます。 | 共有済みの履歴を戻す場合は、resetによる書き換えとrevertによる追加を区別します。 |
| level-5-2 | state_matches: head, index, working | HEADがc1へ戻り、error.txtがindexと作業ツリーに残ることを確認します。 | 実務で共有済みブランチをresetする場合は、他の利用者への影響を確認します。 |
| level-5-3 | state_matches: message, missingCommitted, working | HEADにerror.txtがなく、メッセージがCorrect commitであることを確認します。 | 作業ファイルの削除だけではindexに残ることがあります。コミット対象も確認します。 |
| level-5-4 | state_matches: head, clean, working | HEADがc1、追跡ファイルがクリーンで、bad.txtがなくなったことを確認します。 | 未コミットの追跡ファイルの変更は失われます。無関係な未追跡ファイルをすべて削除する操作ではありません。 |
| level-6-1 | command_executed: command | logでコミットの順とc1の位置を確認します。 | このアプリのc1等は教材用IDです。実Gitはハッシュを使います。 |
| level-6-2 | state_matches: detached, head | HEADが直接c1を指し、Detached HEADになっていることを確認します。 | ここで作ったコミットを残すには、離れる前にブランチを作ります。 |
| level-6-3 | branch_exists: name, checkedOut | HEADがmainへ戻り、mainの作業内容になったことを確認します。 | Detached HEADで新しい記録を作った場合、必要な履歴を先にブランチで保護します。 |
| level-7-1 | conflict_present:  | マーカー、ファイル一覧、操作中の状態で競合の発生を確認します。 | この課題では競合による意図した停止が達成です。模擬エンジンの競合判定は主にファイル単位です。 |
| level-7-2 | command_executed: command | statusのunmerged表示と、対象index.htmlを確認します。 | 競合の発生と、解消してstageした状態は別です。 |
| level-7-3 | conflict_resolved: name, acceptedContents | index.htmlのプレビューでHTML構造と必要な見出しを確認します。 | 現在側、取り込み側、両方がこの教材の許容結果です。両方を採用しても一般のコードが正しく動く保証はありません。 |
| level-7-4 | state_matches: branch, parents, acceptedTreeContents | mainの最新コミットの親、index.htmlの内容、merge終了を確認します。 | 解消内容の適用だけではmergeは終わりません。このアプリではadd後にcommitで完了します。 |
| daily-status | command_executed: command | statusの分類と三つの対象を照らし合わせます。 | statusはファイルの内容を変えません。調べる課題は確認操作の成功を採点します。 |
| daily-diff | command_executed: command | diffでversion 1からversion 2への変更を読みます。 | 通常のdiffはHEADと作業ツリーの全差分ではありません。ステージ済みの差は別に確認します。 |
| daily-staged-diff | command_executed: command | ステージ済み差分でversion 2が対象と分かることを確認します。 | この課題はindex対HEADの確認です。通常のdiffだけでは違う領域を見ます。 |
| daily-select | state_matches: tree, working | HEADのREADME.mdがProject、作業ツリーではDraftであることを確認します。 | add .でREADME.mdまで選ぶと、今回の記録範囲が広がります。 |
| daily-after-stage | state_matches: tree, working | HEADと作業ツリーのapp.tsを比べ、異なる二つの版が残ることを確認します。 | 再度addするとversion 3へ選び直します。この課題では選び直す必要がありません。 |
| daily-unstage | state_matches: index, working | indexがversion 1で、作業ファイルがversion 2のままであることを確認します。 | 作業ツリーを戻すrestoreと、indexを戻すrestore --stagedを区別します。 |
| daily-restore | state_matches: working, clean | プレビューとstatusで追跡ファイルに差がなくなったことを確認します。 | restoreで消した未記録の編集は、コミットの履歴から復旧できるとは限りません。 |
| daily-restore-index | state_matches: working, index | 作業ツリーとindexがともにversion 2であることを確認します。 | HEADはversion 1のままです。編集がないことと、コミット済みであることは別です。 |
| daily-delete | state_matches: message, missingCommitted, working | コミットにREADME.mdがなく、メッセージがRemove READMEであることを確認します。 | この課題はメッセージも指定しています。過去のコミットの内容は削除されません。 |
| daily-move | state_matches: tree, working | HEADと作業ツリーでapp.tsがなく、main.tsがversion 1であることを確認します。 | 実Gitのrename表示は内容の類似性から判断されます。ファイル内容を保つことが大切です。 |
| daily-amend-message | state_matches: message, parents, tree | 親が増えず、内容を保ってメッセージがClarify setupになったことを確認します。 | IDが変わるので、共有済みの履歴の書き換えはチームの合意が必要です。 |
| daily-amend-file | state_matches: message, parents, tree | 親とメッセージを保ち、HEADのREADME.mdがUpdatedであることを確認します。 | amend --no-editはメッセージを保ちます。作業ツリーを編集しただけでは追加されません。 |
| daily-switch | branch_exists: name, checkedOut | HEADとブランチ名がfeature/loginであることを確認します。 | 作成済みの同名ブランチは新規作成できません。作成と移動を分ける別解もあります。 |
| daily-split | state_matches: historyMessages, historyTrees, tree, clean | 各コミットの内容と、最後からUpdate docs、Update appの順を確認します。 | 二つのメッセージだけでは分割を証明できません。最初のコミットに文書変更を混ぜないことを確認します。 |
| github-create | github_state: status, title, headBranch, baseBranch, bodyNonEmpty | PRのhead、base、タイトルAdd loginと空でない説明を確認します。 | ghはGitHub CLI、simulateはアプリ専用です。この課題では実アカウントや通信を使いません。 |
| github-view | command_executed: command | PR #1のタイトル、本文、統合先、レビュー、CIを読みます。 | viewは承認やマージを行いません。模擬レビューと模擬CIは実サービスではありません。 |
| github-review-feedback | github_state: review, command | PR #1を表示し、最新コミットへのchanges_requestedと依頼文を確認します。 | simulateでレビュアーの反応を再現します。実GitHubではレビュアーが投稿します。 |
| github-ci-failure | github_state: checks, command | PR #1のチェック結果でfailureを確認します。 | simulateは失敗結果を設定するだけです。実際のテストやジョブを実行しません。 |
| github-approval | github_state: review | PR #1のreviewが最新の公開コミットへのapprovedであることを確認します。 | 修正をpushすると、このアプリでは以前の承認だけでmergeできません。 |
| github-ci-success | github_state: checks, command | PR #1のチェック結果で最新コミットへのsuccessを確認します。 | 模擬CIの成功は、実際のコード品質を保証しません。実サービスではジョブ内容を読む必要があります。 |
| github-merge | github_state: status, tree | PRがmergedで、模擬サーバーのmainにapp.tsのversion 2があることを確認します。 | この模擬PRはmerge方式を扱います。squash/rebase方式や実GitHubへの接続は含みません。 |
| github-close | github_state: status, tree | PRがclosedで、mainのapp.tsがversion 1のままであることを確認します。 | closeとmergeは別の結果です。不要な提案を閉じてもブランチの履歴は残ります。 |
| github-review-fix | github_state: status, tree | 更新後の公開コミットへの承認とCI成功、mainのversion 3を確認します。 | 手元のcommitだけではPRは更新されません。push先と最新コミットの対応を確認します。 |
| remote-clone | state_matches: branch, head, working, upstreams | mainのc2、app.tsのversion 2、origin/mainへの追跡設定を確認します。 | mock://は仮想URLで外部通信しません。実Gitのcloneは別ディレクトリを作ります。 |
| remote-list | command_executed: command | remote -vのURLと、fetch/pushの用途を読みます。 | この演習のURLは模擬接続先です。ホストのGit設定には影響しません。 |
| remote-add | state_matches: remotes | originのURLがmock://team/projectになったことを確認します。 | 実務ではリポジトリのURLと権限を確認します。このアプリは仮想接続先だけを扱います。 |
| remote-url | state_matches: remotes | originのURLがmock://team/new-projectであることを確認します。 | URLの変更と追跡参照の更新は別です。変更しただけで新しいコミットは取得しません。 |
| remote-fetch | state_matches: branch, head, remoteBranches, working | origin/mainがc2、ローカルHEADがc1、app.tsがversion 1であることを確認します。 | 追跡参照、ローカルブランチ、サーバーのブランチを同じものとして扱わないでください。 |
| remote-pull | state_matches: branch, head, working, clean | HEADがc2で、app.tsがversion 2、追跡ファイルがクリーンであることを確認します。 | --ff-onlyは分岐していると拒否します。意図しないマージを防ぐ使い方です。 |
| remote-first-push | state_matches: serverBranches, upstreams | 模擬サーバーのmainがc1で、upstreamがorigin/mainであることを確認します。 | pushの成功と追跡設定は別の条件です。-uで両方を設定できます。 |
| remote-push | state_matches: serverBranches, remoteTree | サーバーのmainがc3を指し、README.mdがLocal docsであることを確認します。 | 作業ツリーの編集はpushされません。コミットした履歴が送信対象です。 |
| remote-integrate | state_matches: remoteTree, tree, clean | 手元とサーバーの両方にapp.tsとREADME.mdの必要な内容があることを確認します。 | 強制pushで片方を消す目的ではありません。相手の履歴を確認して統合します。 |
| remote-rebase | state_matches: historyMessages, remoteTree | Local docs、Team update、Initialの順と、サーバーに双方の内容があることを確認します。 | rebaseはコミットIDを変えます。既に共有した履歴を書き換えるときは合意が必要です。 |
| remote-prune | state_matches: branch, head, remoteBranches | origin/obsoleteが消え、ローカルmainはc1のままであることを確認します。 | pruneはローカルの同名ブランチを削除する操作ではありません。 |
| remote-remove | state_matches: remotes, remoteBranches | originとorigin/mainがなくなったことを確認します。 | 実際のサーバーのリポジトリを消す操作ではありません。ローカル履歴は別に残ります。 |
| history-graph | command_executed: command | 一行メッセージと全ブランチのグラフで共通の親を確認します。 | --allは他の参照も含めます。通常のlogは現在のHEAD側をたどります。 |
| history-show | command_executed: command | c2のFeatureメッセージとapp.tsの差分を読みます。 | showは作業ファイルを過去へ切り替えません。 |
| history-show-file | command_executed: command | c1時点のapp.tsを読み、現在の作業内容が変わらないことを確認します。 | c1:app.tsの区切りはコロンです。このアプリのc1は教材用のIDです。 |
| history-config | state_matches: config | user.nameがLearner、user.emailがlearner@example.testであることを確認します。 | 設定はブラウザ内だけです。実Gitにはlocal/global/systemの設定範囲があります。 |
| history-rename-branch | state_matches: branches | featureが消え、feature/loginがc2を指すことを確認します。 | ローカルの名前変更だけでは、サーバー側のブランチ名は変更されません。 |
| history-delete-branch | state_matches: branch, branches | HEADがmainで、featureがなく、mainがc2を指すことを確認します。 | -dは未統合の履歴を守ります。強制削除の-Dとは条件が異なります。 |
| history-detached-rescue | state_matches: branch, branches, working | HEADがrescueを指し、app.tsがversion 2であることを確認します。 | Detached HEADで作ったコミットを残す場合も、離れる前に参照を作ります。 |
| history-no-ff | state_matches: branch, parents, tree, clean | 新しいコミットの親がc1とc2で、app.tsがversion 2であることを確認します。 | --no-ffは履歴の見せ方を変えます。常に必要な方式ではなく、チームの方針に合わせます。 |
| history-rebase | state_matches: branch, parents, tree | featureの最新コミットの親がc3で、アプリと文書の変更が残ることを確認します。 | rebase後はコミットIDが変わります。共有済みの履歴では他の利用者への影響を確認します。 |
| history-pick | state_matches: branch, parents, message, tree | 親がc3で、Featureの内容とDocumentationが共存することを確認します。 | cherry-pickはブランチ全体の統合ではありません。同じ変更の二重適用にも注意します。 |
| history-revert | state_matches: parents, message, tree | 元の履歴を親に持つ取り消しコミットと、文書が残ることを確認します。 | resetと違って履歴を消しません。後の変更と競合する場合は内容の判断が必要です。 |
| history-reflog | command_executed: command | reset前のHEADがc2だったことを読みます。 | 実Gitのreflogには保存期間があり、他の端末の記録は共有されません。 |
| history-recover-reset | state_matches: branch, head, branches, working | mainがc1、rescueがc2で、元のapp.tsが戻ることを確認します。 | reflogで救えるのは主にコミット済みの内容です。未コミット編集の復元を保証しません。 |
| history-tag | state_matches: tags | v1.0.0がmainのc3を指すことを確認します。 | ブランチと異なり、タグは通常、新しいコミットを作っても進めません。 |
| history-annotated-tag | state_matches: tags, tagMessages | v1.1.0がc3で、注釈がRelease 1.1.0であることを確認します。 | この模擬環境は署名やタグオブジェクト全体を再現しません。 |
| history-tag-branch | state_matches: branch, head, working | HEADがmaintenanceのc1で、app.tsがversion 1であることを確認します。 | タグを移動する代わりに、新しいブランチで保守の履歴を伸ばします。 |
| operation-rebase-continue | state_matches: operation, branch, parents, message, tree | 解消内容をstageし、featureの親がc2で進行中の操作がなくなることを確認します。 | ファイルを書き換えるだけでは続行できません。実Gitのrebase中はours/theirsの意味も確認します。 |
| operation-rebase-abort | state_matches: command, operation, branch, head, working | rebaseを中断する操作を成功させ、HEADがc3、app.tsがfeature versionへ戻ることを確認します。 | abortとskipは別です。skipは現在の変更を外して後の変更へ進みます。 |
| operation-pick-continue | state_matches: operation, branch, parents, message, tree | stage後に続行し、Featureの記録と親c2、操作の終了を確認します。 | cherry-pickの続行にはcherry-pickの操作を使います。別の履歴操作の続行とは交換できません。 |
| operation-pick-abort | state_matches: command, operation, head, working | 中断操作の成功、HEADのc2、app.tsのmain versionを確認します。 | 元の履歴を戻すことと、解消して新しい記録を作ることは別の復旧方法です。 |
| operation-revert-continue | state_matches: operation, parents, message, tree | 解消してstageした後、親c4の取り消しコミットと操作終了を確認します。 | revertも競合します。履歴を消さず、必要な内容を残す取り消しを作ります。 |
| operation-revert-abort | state_matches: command, operation, head, working | 中断操作、HEADのc4、app.tsのlater versionを確認します。 | abortは今回のrevertを取りやめます。既に成功した過去のrevertを取り消す操作ではありません。 |
| stash-tracked | state_matches: stashCount, working, clean | stashが一件、app.tsがbase、notes.txtがmemoであることを確認します。 | 通常のstashは未追跡を含みません。保存範囲を確認します。 |
| stash-untracked | state_matches: stashCount, working | stashが一件で、app.tsがbase、notes.txtが作業場所からなくなることを確認します。 | -uは未追跡を含めますがignore対象は含めません。このアプリもその境界を扱います。 |
| stash-apply | state_matches: stashCount, working | app.tsがdraftで、stashが一件残ることを確認します。 | applyは保管を削除しません。複数回適用すると競合する場合があります。 |
| stash-pop | state_matches: stashCount, working | app.tsがdraft、stashが零件であることを確認します。 | popが競合すると保管は残ります。成功した復元と失敗した復元を区別します。 |
| stash-select | state_matches: stashCount, working | app.tsがdraftで、stashの件数が二件のままであることを確認します。 | stashの番号は新しい保管や削除で変わります。適用前に対象を確認します。 |
| stash-drop | state_matches: stashCount, working | stashが零件、app.tsがbaseのままであることを確認します。 | dropした内容の復旧を保証しません。保管内容が不要かを先に確認します。 |
| stash-conflict | state_matches: stashCount, working, index, head, unmergedPaths | app.tsの作業ツリーとindexがCombined、HEADがc2、stashが一件残ることを確認します。git statusでUnmerged pathsがなくなり、git diff --stagedで解消内容を確認できます。 | 内容を編集するだけでは未解消パスは残ります。stageしても内容の正しさは保証されません。内容とindexを確認し、保管の削除は復元結果を読んでから行います。 |
| interactive-squash | state_matches: operation, parents, message, tree | 二つの内容を保ち、親c1とFeature・Docs両方のメッセージを確認します。 | todoは画面またはsimulateで編集します。実Gitはエディタを使い、まとめるメッセージも編集できます。 |
| interactive-fixup | state_matches: operation, parents, message, tree | 両ファイルの内容と、親c1、メッセージFeatureを確認します。 | squashとfixupは残すメッセージが違います。共有済み履歴の書き換えは合意が必要です。 |
| interactive-reword | state_matches: operation, historyMessages, tree | 履歴のDocs、Improve app、Initialという順と、両ファイルの内容を確認します。 | このアプリのrewordは一時停止後にamendします。実Gitではメッセージ用エディタが開きます。 |
| interactive-reorder | state_matches: operation, historyMessages, tree | 古い順ではDocsからFeatureへ進み、両方の内容が残ることを確認します。 | 順序を変えると変更の依存関係によって競合します。任意の並べ替えが成功するわけではありません。 |
| interactive-drop | state_matches: operation, parents, message, tree | app.tsがversion 1へ戻り、文書とDocsのメッセージが残ることを確認します。 | dropはその変更を適用しません。後のコミットが依存していると競合する場合があります。 |
| interactive-split | state_matches: operation, historyMessages, historyTrees, tree | Docs、App、Initialという履歴と、途中のAppに文書変更を混ぜていないことを確認します。 | mixed resetは編集内容を残します。続行前に必要な記録を作り、追跡ファイルをクリーンにします。 |
| advanced-bisect-start | state_matches: bisectActive | 操作案内にbisectの調査中と表示されることを確認します。 | この模擬調査は主に第一親の直線履歴です。実Gitの複雑な履歴全体を再現しません。 |
| advanced-bisect-candidate | state_matches: bisectActive, head | bisect中でHEADがc3になり、候補ファイルを読めることを確認します。 | good/badは実際に検証した結果を指定します。名前から推測して判定する手順ではありません。 |
| advanced-bisect-find | state_matches: bisectFound, bisectActive | 候補ごとのapp.tsを読み、最終的に原因c3と表示されることを確認します。 | 模擬課題はファイル内の目印で検証します。実務では再現手順やテストで良否を判断します。 |
| advanced-bisect-reset | state_matches: bisectFound, bisectActive, branch, head | 原因c3の記録、bisect終了、mainのc5への復帰を確認します。 | 原因を特定しただけでは作業先は戻りません。調査の終了操作が必要です。 |
| advanced-worktree-add | state_matches: worktrees, working, branches | 仮想worktreeのhotfixと、元のmainのdraftが両方残ることを確認します。 | 実ディスクには作成しません。実Gitのworktreeは履歴を共有し、作業ツリーとindexを別々に持ちます。 |
| advanced-worktree-fix | state_matches: branch, tree, branches, worktreeWorking | hotfixのapp.tsがFixed、mainがc1、元の作業場所にdraftが残ることを確認します。 | 仮想のcdで作業先を移します。履歴を共有することと、作業ファイルを共有することは別です。 |
| advanced-worktree-remove | state_matches: worktrees, branches | 仮想worktreeがなくなり、hotfixがc1を指すことを確認します。 | worktree削除とブランチ削除は別です。実務では未記録の変更がないことを先に確認します。 |
| advanced-sparse | state_matches: sparseCheckout, working, tree, clean | srcとルートREADMEが作業場所にあり、testsは非表示でもHEADに残ることを確認します。 | このアプリは基本的なcone形式を模擬します。非表示の追跡ファイルを削除と混同しないでください。 |
| advanced-sparse-disable | state_matches: sparseCheckout, working, clean | sparse設定が解除され、README、src、testsがクリーンに展開されることを確認します。 | 表示範囲を広げる操作であり、新しいファイルをコミットする操作ではありません。 |
| advanced-submodule-add | state_matches: submodules, tree | vendor/libが初期化され、親のコミットにdep1への参照があることを確認します。 | このアプリは参照を文字列として模擬します。実Gitはgitlinkと.gitmodulesを使い、別リポジトリを管理します。 |
| advanced-submodule-init | state_matches: submodules | vendor/libのdep1と初期化済み状態を確認します。 | update --initは通常、親が指定したコミットを取得します。依存側の最新を自動で採用する目的ではありません。 |
| advanced-submodule-update | state_matches: submodules, tree | submoduleがdep2で、HEADのvendor/libにもdep2が記録されることを確認します。 | 依存側の更新だけでは親のコミットは変わりません。参照をadd・commitする必要があります。 |
| advanced-lfs-install | state_matches: lfsInstalled | 模擬LFSの初期化が有効になったことを確認します。 | 設定のみの演習です。実際のバイナリ転送やポインタ変換は行いません。 |
| advanced-lfs-track | state_matches: lfsInstalled, lfsPatterns, tree | LFSの初期化、*.pngのルール、HEADの.gitattributesを確認します。 | この模擬環境は属性設定だけを扱います。実Git LFSのポインタとバイナリ転送は別に必要です。 |
| precision-patch | state_matches: tree, working | HEADではfeature=on・logging=off、作業ツリーではlogging=onであることを確認します。 | add -pのy/n/qは提示中のハンクに対する応答です。実Gitには追加の対話選択肢もあります。 |
| precision-ignore | state_matches: tree, working | HEADに.gitignoreがありbuild/output.txtがなく、作業ファイルは残ることを確認します。 | ignoreは未追跡ファイルの選択を抑制します。既に追跡済みのファイルは別に追跡を外します。 |
| precision-untrack | state_matches: tree, working | HEADに*.logのルールがあり、debug.logは履歴になく手元に残ることを確認します。 | rm --cachedは作業ファイルを消しません。ignoreを書くだけでは追跡をやめません。 |
| precision-blame | command_executed: command | app.tsの行ごとのIDとメッセージを読みます。 | この模擬環境は一本の親履歴を追います。実Gitの移動・コピー検出等をすべて再現しません。 |
| precision-diff-commits | command_executed: command | 古い版から新しい版への追加・削除行を読みます。 | 比較する二つの参照の順を逆にすると、追加と削除も逆になります。 |
| precision-log-file | command_executed: command | 対象パスに変更のあるコミットのメッセージと順を確認します。 | --の後はパスとして指定します。この模擬環境の履歴探索は主に第一親です。 |
| precision-log-grep | command_executed: command | Featureを含むコミットが表示されることを確認します。 | メッセージ検索とファイル内容の検索は別です。この課題は模擬のメッセージ検索を扱います。 |
| precision-lease | state_matches: remoteTree, tree, clean | fetch後の変更を読み、双方の内容が手元とサーバーへ残ることを確認します。 | fetchしてから機械的に強制pushする手順ではありません。更新の内容を判断して通常の統合をします。 |
| precision-tag-push | state_matches: serverTagBranches, serverBranches | 公開v1.0.0がローカルmainを指し、サーバーのmainはc1のままであることを確認します。 | 通常のブランチpushでタグもすべて送られるわけではありません。対象を指定します。 |
| workflow-feature | github_state: status, tree | PRの最新レビュー・CIと、統合先mainのfeature.txtを確認します。 | simulateは模擬確認です。実務では変更の説明、テスト結果、レビュー内容を確認します。 |
| workflow-conflict | state_matches: parents, tree, remoteTree, clean | Combinedの内容と二つの親、手元・サーバー双方の状態を確認します。 | 競合による停止は途中状態です。この総合課題は解消と共有までを採点します。 |
| workflow-urgent | state_matches: branch, tree, working, branchTrees, stashCount | mainとfeatureのFixed、復元したWorking、空のstashを確認します。 | 統合・移植・作業復元は別の段階です。退避内容を誤ったブランチへ戻さないよう確認します。 |
| workflow-cleanup | state_matches: operation, branch, historyMessages, tree, clean | FeatureとTeam docsの順、Combined docs、notes.mdのKeepと操作終了を確認します。 | fixupとrebaseでIDが変わります。共有前の整理として使い、必要な文書を消さないよう確認します。 |
| workflow-recovery | state_matches: branch, head, branches, working | featureの不在、rescueのc2、app.tsのFeatureを確認します。 | ブランチ名を消すことと、コミット内容の即時消去は別です。実Gitの記録には期限があります。 |
| workflow-revert | state_matches: parents, message, tree, remoteTree | 親c3の取り消しコミットと、手元・サーバーのアプリと文書内容を確認します。 | 共有履歴をresetで置き換えず、取り消しの理由を新しい履歴として残す方法です。 |
| workflow-release | state_matches: branch, tree, remoteTree, branchTrees, tagBranches, serverTagBranches, tagMessages | maintenanceとmainのFixed、v1.0.1の参照・注釈・公開状態を確認します。 | タグの共有とmainのpushは別です。修正を両系統へ反映したことを確認します。 |

## 編集時の必須項目

1. Scenarioに状況/独立初期状態、対象/期待結果のdescription、採点goal、代表solutionと意図したexpectedFailuresを記録する。
2. lesson-notes.tsへ考え方・具体的な確認・実務注意/実Gitとの差を追加する。課題別notesなしはテストで拒否する。
3. learning-pathの推奨順と準備を確認する。前提を必須の完了ロックにせず、自由選択を維持する。
4. 目標の状態/操作指定を区別し、未知のgoalキーを黙認しない。述語と条件ラベルを同時に追加する。
5. 正解、対象違い/不足状態、失敗した操作、許容別解を実行検証する。状態課題を解答文字列だけで採点しない。
6. 新しい別解の表示/教材記載は実行して合格を確認する。代表解は一例で、未対応の実Git構文を保証しない。
7. カタログ/READMEの件数を揃え、unitと必要な画面E2Eを更新する。保存ID/形式変更は移行とrollbackも確認する。

## 今回検証した別解

| ID | 別解 | 検証する状態 |
| --- | --- | --- |
| level-1-2 | echoでREADME.md作成 | 作業ファイルの存在 |
| level-1-4 | git add . | README.mdのステージ |
| level-1-10 | 独自のapp.ts内容とcommitメッセージ | app.tsの記録 |
| level-2-1 | git checkout -b feature | featureブランチの存在 |
| level-2-2 | git checkout feature | HEADのfeatureへの移動 |
| daily-delete | rm→git add→commit | README.mdの記録からの削除 |
| github-create | 別の空でないPR説明 | 指定title/head/baseと非空説明 |

## 一次資料と比較範囲

indexを記録するcommitは [git-commit](https://git-scm.com/docs/git-commit)、restoreの戻し元/領域は [git-restore](https://git-scm.com/docs/git-restore)、載せ替えとtodo/停止は [git-rebase](https://git-scm.com/docs/git-rebase) を確認した。既存のGit/GitHub/LFSの資料は [カリキュラム](practical_git_curriculum.md) に保持する。実Gitの再現範囲は比較テストの対象に限り、全コマンド/OS/バージョンの同一性を保証しない。
