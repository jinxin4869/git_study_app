import { Scenario } from '@/types/git';

export const scenarios: Scenario[] = [
  {
    id: 'level-1-1',
    title: 'Level 1-1: リポジトリの作成',
    description: 'Gitを使ってバージョン管理を始めるには、まずリポジトリを初期化する必要があります。',
    difficulty: 'beginner',
    goal: {
      type: 'repo_initialized'
    },
    initialState: undefined, // Start fresh
    hints: [
      '`git init` コマンドを実行してください。',
      'このコマンドは現在のディレクトリに `.git` フォルダを作成します。'
    ]
  },
  {
    id: 'level-1-2',
    title: 'Level 1-2: ファイルの作成',
    description: 'リポジトリができました。次に管理対象となるファイルを作成しましょう。',
    difficulty: 'beginner',
    initialState: {
      commits: {},
      branches: { main: '' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: {},
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'file_exists',
      params: { name: 'README.md' }
    },
    hints: [
      '`touch README.md` コマンドで空のファイルを作成できます。',
      'または `echo "Hello" > README.md` で内容のあるファイルを作成できます。'
    ]
  },
  {
    id: 'level-1-3',
    title: 'Level 1-3: 状態の確認',
    description: 'ファイルを作成しましたが、Gitはまだこのファイルを管理していません。現在の状態を確認してみましょう。',
    difficulty: 'beginner',
    initialState: {
      commits: {},
      branches: { main: '' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': '' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'command_executed', // 'git status' が実行されたか確認
      params: { command: 'status' }
    },
    hints: [
      '`git status` コマンドを実行してください。',
      'Untracked files（追跡されていないファイル）として `README.md` が表示されるはずです。'
    ]
  },
  {
    id: 'level-1-4',
    title: 'Level 1-4: ステージング',
    description: 'ファイルをコミットする前に、ステージングエリア（インデックス）に追加する必要があります。',
    difficulty: 'beginner',
    initialState: {
      commits: {},
      branches: { main: '' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': '' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'file_staged',
      params: { name: 'README.md' }
    },
    hints: [
      '`git add README.md` を実行してください。',
      'すべてのファイルをステージングするには `git add .` も使えます。'
    ]
  },
  {
    id: 'level-1-5',
    title: 'Level 1-5: 最初のコミット',
    description: 'ステージングされた変更をリポジトリに記録（コミット）しましょう。',
    difficulty: 'beginner',
    initialState: {
      commits: {},
      branches: { main: '' },
      HEAD: { type: 'branch', value: 'main' },
      index: { 'README.md': { path: 'README.md', status: 'staged', content: '' } },
      workingDirectory: { 'README.md': '' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'commit_count',
      params: { count: 1 }
    },
    hints: [
      '`git commit -m "First commit"` のようにメッセージを添えて実行します。',
      'メッセージは変更内容を簡潔に説明するものにします。'
    ]
  },
  {
    id: 'level-1-6',
    title: 'Level 1-6: 履歴の確認',
    description: 'コミットが正しく行われたか、履歴を確認してみましょう。',
    difficulty: 'beginner',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'First commit', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'README.md': '' } }
      },
      branches: { main: 'c1' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': '' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'command_executed',
      params: { command: 'log' }
    },
    hints: [
      '`git log` コマンドを実行してください。',
      'コミットID、作者、日時、メッセージが表示されます。'
    ]
  },
  {
    id: 'level-1-7',
    title: 'Level 1-7: ファイルの変更',
    description: '既存のファイルを変更してみましょう。`README.md` に内容を追記します。',
    difficulty: 'beginner',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'First commit', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'README.md': '' } }
      },
      branches: { main: 'c1' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': '' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'file_modified',
      params: { name: 'README.md' }
    },
    hints: [
      '`echo "Hello Git" > README.md` を実行してファイルを書き換えてください。',
      'または `touch README.md` でも変更扱い（タイムスタンプ更新）になりますが、今回は内容を変えてみましょう。'
    ]
  },
  {
    id: 'level-1-8',
    title: 'Level 1-8: 差分の確認',
    description: 'ファイルが変更されました。具体的に何が変わったのか確認しましょう。',
    difficulty: 'beginner',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'First commit', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'README.md': '' } }
      },
      branches: { main: 'c1' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': 'Hello Git' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'command_executed', // 理想的には 'diff' か 'status' を確認
      params: { command: 'status' } // status は modified を表示する
    },
    hints: [
      '`git status` で変更があることを確認します。',
      '（今回は実装されていませんが、通常は `git diff` で内容の差分も見れます）'
    ]
  },
  {
    id: 'level-1-9',
    title: 'Level 1-9: 変更のコミット',
    description: '変更したファイルを再度ステージングして、新しいコミットとして記録しましょう。',
    difficulty: 'beginner',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'First commit', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'README.md': '' } }
      },
      branches: { main: 'c1' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': 'Hello Git' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'commit_count',
      params: { count: 2 }
    },
    hints: [
      'まず `git add README.md` でステージングします。',
      '次に `git commit -m "Update README"` でコミットします。'
    ]
  },
  {
    id: 'level-1-10',
    title: 'Level 1-10: 総合演習',
    description: '新しいファイル `app.ts` を作成し、それをコミットしてください。',
    difficulty: 'beginner',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'First commit', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'README.md': '' } },
        'c2': { id: 'c2', message: 'Update README', parents: ['c1'], timestamp: 200, author: 'User', changes: [], tree: { 'README.md': 'Hello Git' } }
      },
      branches: { main: 'c2' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': 'Hello Git' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'file_committed',
      params: { name: 'app.ts' }
    },
    hints: [
      '1. `touch app.ts`',
      '2. `git add app.ts`',
      '3. `git commit -m "Add app.ts"`'
    ]
  },
  {
    id: 'level-2-1',
    title: 'Level 2-1: ブランチの作成',
    description: '新しい機能を開発するために、`feature` という名前のブランチを作成しましょう。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } }
      },
      branches: { main: 'c1' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': 'Hello' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'branch_exists',
      params: { name: 'feature' }
    },
    hints: [
      '`git branch feature` でブランチを作成します。',
      '`git checkout -b feature` なら作成と切り替えを同時に行えます。'
    ]
  },
  {
    id: 'level-2-2',
    title: 'Level 2-2: ブランチの切り替え',
    description: '作成した `feature` ブランチに切り替えて、作業の準備をしましょう。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } }
      },
      branches: { main: 'c1', feature: 'c1' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': 'Hello' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'branch_exists',
      params: { name: 'feature', checkedOut: true }
    },
    hints: [
      '`git checkout feature` または `git switch feature` でブランチを切り替えます。'
    ]
  },
  {
    id: 'level-2-3',
    title: 'Level 2-3: ブランチでの作業',
    description: '`feature` ブランチで新しいファイル `feature.txt` を作成してください。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } }
      },
      branches: { main: 'c1', feature: 'c1' },
      HEAD: { type: 'branch', value: 'feature' },
      index: {},
      workingDirectory: { 'README.md': 'Hello' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'file_exists',
      params: { name: 'feature.txt' }
    },
    hints: [
      '`touch feature.txt` コマンドでファイルを作成します。'
    ]
  },
  {
    id: 'level-2-4',
    title: 'Level 2-4: ブランチでのコミット',
    description: '作成した `feature.txt` をステージングしてコミットしてください。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } }
      },
      branches: { main: 'c1', feature: 'c1' },
      HEAD: { type: 'branch', value: 'feature' },
      index: {},
      workingDirectory: { 'README.md': 'Hello', 'feature.txt': '' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'commit_count',
      params: { count: 2 }
    },
    hints: [
      '`git add feature.txt`',
      '`git commit -m "Add feature"`'
    ]
  },
  {
    id: 'level-2-5',
    title: 'Level 2-5: mainブランチへ戻る',
    description: '`main` ブランチに戻りましょう。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } },
        'c2': { id: 'c2', message: 'Add feature', parents: ['c1'], timestamp: 2, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'feature.txt': '' } }
      },
      branches: { main: 'c1', feature: 'c2' },
      HEAD: { type: 'branch', value: 'feature' },
      index: {},
      workingDirectory: { 'README.md': 'Hello', 'feature.txt': '' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'branch_exists',
      params: { name: 'main', checkedOut: true }
    },
    hints: [
      '`git checkout main` または `git switch main`'
    ]
  },
  {
    id: 'level-2-6',
    title: 'Level 2-6: 状態の確認',
    description: '`main` ブランチに戻りました。先ほど作成した `feature.txt` が存在しないことを確認してください。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } },
        'c2': { id: 'c2', message: 'Add feature', parents: ['c1'], timestamp: 2, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'feature.txt': '' } }
      },
      branches: { main: 'c1', feature: 'c2' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': 'Hello' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'file_missing',
      params: { name: 'feature.txt' }
    },
    hints: [
      '`ls` コマンドでファイル一覧を確認します。',
      '`feature.txt` が表示されなければOKです。'
    ]
  },
  {
    id: 'level-2-7',
    title: 'Level 2-7: mainブランチでの作業',
    description: '`main` ブランチでも別の作業が進んでいます。`main.txt` を作成してください。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } },
        'c2': { id: 'c2', message: 'Add feature', parents: ['c1'], timestamp: 2, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'feature.txt': '' } }
      },
      branches: { main: 'c1', feature: 'c2' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': 'Hello' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'file_exists',
      params: { name: 'main.txt' }
    },
    hints: [
      '`touch main.txt`'
    ]
  },
  {
    id: 'level-2-8',
    title: 'Level 2-8: mainブランチでのコミット',
    description: '`main.txt` をコミットしてください。これで履歴が分岐します。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } },
        'c2': { id: 'c2', message: 'Add feature', parents: ['c1'], timestamp: 2, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'feature.txt': '' } }
      },
      branches: { main: 'c1', feature: 'c2' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': 'Hello', 'main.txt': '' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'commit_count',
      params: { count: 2 } // mainブランチの履歴内
    },
    hints: [
      '`git add main.txt`',
      '`git commit -m "Add main.txt"`'
    ]
  },
  {
    id: 'level-2-9',
    title: 'Level 2-9: 分岐した履歴の確認',
    description: '履歴が分岐していることを確認しましょう。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } },
        'c2': { id: 'c2', message: 'Add feature', parents: ['c1'], timestamp: 2, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'feature.txt': '' } },
        'c3': { id: 'c3', message: 'Add main.txt', parents: ['c1'], timestamp: 3, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'main.txt': '' } }
      },
      branches: { main: 'c3', feature: 'c2' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': 'Hello', 'main.txt': '' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'command_executed',
      params: { command: 'log' }
    },
    hints: [
      '`git log --graph --all` や `git log --oneline --graph --all` を使うと分岐が見やすくなります。',
      '単に `git log` だけでもOKです。'
    ]
  },
  {
    id: 'level-3-1',
    title: 'Level 3-1: マージの準備',
    description: 'マージを行うには、まずマージ「される」側のブランチ（通常は main）に移動する必要があります。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } },
        'c2': { id: 'c2', message: 'Add feature', parents: ['c1'], timestamp: 2, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'feature.txt': 'Feature' } }
      },
      branches: { main: 'c1', feature: 'c2' },
      HEAD: { type: 'branch', value: 'feature' },
      index: {},
      workingDirectory: { 'README.md': 'Hello', 'feature.txt': 'Feature' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'branch_exists',
      params: { name: 'main', checkedOut: true }
    },
    hints: [
      '`git checkout main` または `git switch main`'
    ]
  },
  {
    id: 'level-3-2',
    title: 'Level 3-2: Fast-forwardマージ',
    description: '`feature` ブランチの変更を `main` ブランチに取り込みます。これはFast-forwardマージになります。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } },
        'c2': { id: 'c2', message: 'Add feature', parents: ['c1'], timestamp: 2, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'feature.txt': 'Feature' } }
      },
      branches: { main: 'c1', feature: 'c2' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': 'Hello' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'merge_complete',
      params: { branch: 'main', mergedCommit: 'c2' } // mainがc2を指しているか確認
    },
    hints: [
      '`git merge feature` を実行します。',
      '分岐がないため、単にポインタが進むだけです（Fast-forward）。'
    ]
  },
  {
    id: 'level-3-3',
    title: 'Level 3-3: 別のブランチでの作業',
    description: '次はFast-forwardにならないマージを体験します。まず新しいブランチ `feature2` を作成し、変更をコミットしてください。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } },
        'c2': { id: 'c2', message: 'Add feature', parents: ['c1'], timestamp: 2, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'feature.txt': 'Feature' } }
      },
      branches: { main: 'c2', feature: 'c2' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': 'Hello', 'feature.txt': 'Feature' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'commit_count',
      params: { count: 3 }
    },
    hints: [
      '1. `git checkout -b feature2`',
      '2. `touch feature2.txt`',
      '3. `git add feature2.txt`',
      '4. `git commit -m "Add feature2"`'
    ]
  },
  {
    id: 'level-3-4',
    title: 'Level 3-4: 履歴の分岐',
    description: '`main` ブランチに戻り、`feature2` とは別の変更を行ってコミットしてください。これで履歴が分岐します。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } },
        'c2': { id: 'c2', message: 'Add feature', parents: ['c1'], timestamp: 2, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'feature.txt': 'Feature' } },
        'c3': { id: 'c3', message: 'Add feature2', parents: ['c2'], timestamp: 3, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'feature.txt': 'Feature', 'feature2.txt': 'Feature2' } }
      },
      branches: { main: 'c2', feature: 'c2', feature2: 'c3' },
      HEAD: { type: 'branch', value: 'feature2' },
      index: {},
      workingDirectory: { 'README.md': 'Hello', 'feature.txt': 'Feature', 'feature2.txt': 'Feature2' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'commit_count',
      params: { count: 3 } // c1, c2, c4 (main上の新しいコミット)
    },
    hints: [
      '1. `git checkout main`',
      '2. `touch main-update.txt`',
      '3. `git add main-update.txt`',
      '4. `git commit -m "Update main"`'
    ]
  },
  {
    id: 'level-3-5',
    title: 'Level 3-5: マージコミットの作成',
    description: '`feature2` ブランチを `main` ブランチにマージしてください。今回は履歴が分岐しているため、マージコミットが作成されます。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': 'Hello' } },
        'c2': { id: 'c2', message: 'Add feature', parents: ['c1'], timestamp: 2, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'feature.txt': 'Feature' } },
        'c3': { id: 'c3', message: 'Add feature2', parents: ['c2'], timestamp: 3, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'feature.txt': 'Feature', 'feature2.txt': 'Feature2' } },
        'c4': { id: 'c4', message: 'Update main', parents: ['c2'], timestamp: 4, author: 'User', changes: [], tree: { 'README.md': 'Hello', 'feature.txt': 'Feature', 'main-update.txt': 'Main' } }
      },
      branches: { main: 'c4', feature: 'c2', feature2: 'c3' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': 'Hello', 'feature.txt': 'Feature', 'main-update.txt': 'Main' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'merge_complete',
      params: { branch: 'main' }
    },
    hints: [
      '`git merge feature2` を実行します。',
      '自動的にマージコミットが作成されます。'
    ]
  },
  {
    id: 'level-4-1',
    title: 'Level 4-1: 作業の中断',
    description: '作業中に急な用事が入りました。現在編集中のファイルをそのままにしておくわけにはいきません。まずは状況を確認しましょう。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': '# Hello' } }
      },
      branches: { 'main': 'c1' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': '# Hello\nWork in progress...' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'command_executed',
      params: { command: 'status' }
    },
    hints: [
      '`git status` で変更があることを確認します。'
    ]
  },
  {
    id: 'level-4-2',
    title: 'Level 4-2: 変更の退避 (Stash)',
    description: '変更をコミットせずに一時的に退避（Stash）させて、ワーキングディレクトリをクリーンな状態にしてください。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': '# Hello' } }
      },
      branches: { 'main': 'c1' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': '# Hello\nWork in progress...' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'clean_working_tree'
    },
    hints: [
      '`git stash` または `git stash save "message"` を実行します。'
    ]
  },
  {
    id: 'level-4-3',
    title: 'Level 4-3: 退避した変更の確認',
    description: '退避した変更が正しく保存されているか確認しましょう。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': '# Hello' } }
      },
      branches: { 'main': 'c1' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': '# Hello' },
      detachedHead: false,
      stash: [{ id: 'stash-1', message: 'WIP on main: c1 Initial commit', timestamp: 100, index: {}, workingDirectory: { 'README.md': '# Hello\nWork in progress...' } }],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'command_executed',
      params: { command: 'stash' } // stash list
    },
    hints: [
      '`git stash list` を実行します。'
    ]
  },
  {
    id: 'level-4-4',
    title: 'Level 4-4: 変更の復元',
    description: '用事が済んだので、退避していた変更を元に戻して作業を再開しましょう。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 1, author: 'User', changes: [], tree: { 'README.md': '# Hello' } }
      },
      branches: { 'main': 'c1' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'README.md': '# Hello' },
      detachedHead: false,
      stash: [{ id: 'stash-1', message: 'WIP on main: c1 Initial commit', timestamp: 100, index: {}, workingDirectory: { 'README.md': '# Hello\nWork in progress...' } }],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'file_modified',
      params: { name: 'README.md' }
    },
    hints: [
      '`git stash pop` で最新の退避内容を復元し、リストから削除します。',
      '`git stash apply` ならリストに残したまま復元します（今回はpopを使いましょう）。'
    ]
  },
  {
    id: 'level-5-1',
    title: 'Level 5-1: 間違ったコミット',
    description: '間違った内容を含むファイルをコミットしてしまいました。履歴を確認してみましょう。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'file.txt': 'v1' } },
        'c2': { id: 'c2', message: 'Mistake commit', parents: ['c1'], timestamp: 200, author: 'User', changes: [], tree: { 'file.txt': 'v1', 'error.txt': 'oops' } }
      },
      branches: { 'main': 'c2' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'file.txt': 'v1', 'error.txt': 'oops' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'command_executed',
      params: { command: 'log' }
    },
    hints: [
      '`git log` で直前のコミットを確認します。'
    ]
  },
  {
    id: 'level-5-2',
    title: 'Level 5-2: Soft Reset',
    description: '直前のコミットを取り消したいですが、作業内容は残しておきたいです。Soft Resetを使ってコミットだけを取り消しましょう。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'file.txt': 'v1' } },
        'c2': { id: 'c2', message: 'Mistake commit', parents: ['c1'], timestamp: 200, author: 'User', changes: [], tree: { 'file.txt': 'v1', 'error.txt': 'oops' } }
      },
      branches: { 'main': 'c2' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'file.txt': 'v1', 'error.txt': 'oops' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'commit_count',
      params: { count: 1 }
    },
    hints: [
      '`git reset --soft HEAD~1` を実行します。',
      'HEAD~1 は「今のHEADの1つ前」という意味です。'
    ]
  },
  {
    id: 'level-5-3',
    title: 'Level 5-3: 修正して再コミット',
    description: 'コミットが取り消され、変更はステージングエリアに残っています。不要なファイルを削除して、正しい内容でコミットし直してください。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'file.txt': 'v1' } }
      },
      branches: { 'main': 'c1' },
      HEAD: { type: 'branch', value: 'main' },
      index: { 'error.txt': { path: 'error.txt', status: 'staged', content: 'oops' } },
      workingDirectory: { 'file.txt': 'v1', 'error.txt': 'oops' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'file_missing',
      params: { name: 'error.txt' }
    },
    hints: [
      '今回はシミュレーターの制限上、`git reset` でステージング解除してからファイルを削除するか、',
      '単に `git commit` し直す演習とします。',
      '目標：`error.txt` が存在しない状態にしてコミットする。',
      '1. `rm error.txt` (シミュレーターにrmがないかも？ touchで空にする？)',
      'シミュレーターには `rm` がないので、今回は `git reset` (mixed) でステージングから降ろし、無視することにしましょう。',
      'いや、`git reset` (mixed) を使いましょう。'
    ]
  },
  {
    id: 'level-5-4',
    title: 'Level 5-4: Hard Reset',
    description: '作業内容も含めて完全にコミット前の状態に戻したい場合もあります。Hard Resetを試してみましょう。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'file.txt': 'v1' } },
        'c2': { id: 'c2', message: 'Bad commit', parents: ['c1'], timestamp: 200, author: 'User', changes: [], tree: { 'file.txt': 'v1', 'bad.txt': 'bad' } }
      },
      branches: { 'main': 'c2' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'file.txt': 'v1', 'bad.txt': 'bad' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'commit_count',
      params: { count: 1 }
    },
    hints: [
      '`git reset --hard HEAD~1` を実行します。',
      '注意：ワーキングディレクトリの変更もすべて消えます。'
    ]
  },
  {
    id: 'level-6-1',
    title: 'Level 6-1: 過去のコミットの確認',
    description: 'バグの原因を調査するために、過去のコミットの状態を確認したいです。まずはログを見てコミットIDを確認しましょう。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Feature A', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'app.ts': 'console.log("A")' } },
        'c2': { id: 'c2', message: 'Feature B', parents: ['c1'], timestamp: 200, author: 'User', changes: [], tree: { 'app.ts': 'console.log("A"); console.log("B")' } },
        'c3': { id: 'c3', message: 'Feature C', parents: ['c2'], timestamp: 300, author: 'User', changes: [], tree: { 'app.ts': 'console.log("A"); console.log("B"); console.log("C")' } }
      },
      branches: { 'main': 'c3' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'app.ts': 'console.log("A"); console.log("B"); console.log("C")' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'command_executed',
      params: { command: 'log' }
    },
    hints: [
      '`git log` を実行してください。'
    ]
  },
  {
    id: 'level-6-2',
    title: 'Level 6-2: Detached HEAD',
    description: '`c1` の時点に戻ってみましょう。ブランチを作らずに直接コミットをチェックアウトします。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Feature A', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'app.ts': 'console.log("A")' } },
        'c2': { id: 'c2', message: 'Feature B', parents: ['c1'], timestamp: 200, author: 'User', changes: [], tree: { 'app.ts': 'console.log("A"); console.log("B")' } },
        'c3': { id: 'c3', message: 'Feature C', parents: ['c2'], timestamp: 300, author: 'User', changes: [], tree: { 'app.ts': 'console.log("A"); console.log("B"); console.log("C")' } }
      },
      branches: { 'main': 'c3' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'app.ts': 'console.log("A"); console.log("B"); console.log("C")' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'branch_exists',
      params: { check_detached: true }
    },
    hints: [
      '`git checkout c1` を実行します。',
      'これで "Detached HEAD" 状態になります。'
    ]
  },
  {
    id: 'level-6-3',
    title: 'Level 6-3: ブランチへの復帰',
    description: '調査が終わりました。`main` ブランチに戻りましょう。',
    difficulty: 'intermediate',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Feature A', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'app.ts': 'console.log("A")' } },
        'c2': { id: 'c2', message: 'Feature B', parents: ['c1'], timestamp: 200, author: 'User', changes: [], tree: { 'app.ts': 'console.log("A"); console.log("B")' } },
        'c3': { id: 'c3', message: 'Feature C', parents: ['c2'], timestamp: 300, author: 'User', changes: [], tree: { 'app.ts': 'console.log("A"); console.log("B"); console.log("C")' } }
      },
      branches: { 'main': 'c3' },
      HEAD: { type: 'commit', value: 'c1' },
      index: {},
      workingDirectory: { 'app.ts': 'console.log("A")' },
      detachedHead: true,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'branch_exists',
      params: { name: 'main', checkedOut: true }
    },
    hints: [
      '`git checkout main` または `git switch main` を実行します。'
    ]
  },
  {
    id: 'level-7-1',
    title: 'Level 7-1: コンフリクトの発生',
    description: '`main` ブランチと `feature` ブランチで同じファイルの同じ行を変更してしまいました。マージしてコンフリクトを発生させてみましょう。',
    difficulty: 'advanced',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'index.html': '<html>\n<body>\n<h1>Hello</h1>\n</body>\n</html>' } },
        'c2': { id: 'c2', message: 'Update title to World', parents: ['c1'], timestamp: 200, author: 'User', changes: [], tree: { 'index.html': '<html>\n<body>\n<h1>Hello World</h1>\n</body>\n</html>' } },
        'c3': { id: 'c3', message: 'Update title to Git', parents: ['c1'], timestamp: 300, author: 'User', changes: [], tree: { 'index.html': '<html>\n<body>\n<h1>Hello Git</h1>\n</body>\n</html>' } }
      },
      branches: { 'main': 'c2', 'feature': 'c3' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'index.html': '<html>\n<body>\n<h1>Hello World</h1>\n</body>\n</html>' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'command_executed',
      params: { command: 'merge' } // 理想的にはコンフリクト状態が存在するか確認
    },
    hints: [
      '`git merge feature` を実行します。',
      'コンフリクトが発生した旨のメッセージが表示されます。'
    ]
  },
  {
    id: 'level-7-2',
    title: 'Level 7-2: コンフリクトの確認',
    description: 'コンフリクトが発生しました。`git status` で状態を確認しましょう。',
    difficulty: 'advanced',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'index.html': '<html>\n<body>\n<h1>Hello</h1>\n</body>\n</html>' } },
        'c2': { id: 'c2', message: 'Update title to World', parents: ['c1'], timestamp: 200, author: 'User', changes: [], tree: { 'index.html': '<html>\n<body>\n<h1>Hello World</h1>\n</body>\n</html>' } },
        'c3': { id: 'c3', message: 'Update title to Git', parents: ['c1'], timestamp: 300, author: 'User', changes: [], tree: { 'index.html': '<html>\n<body>\n<h1>Hello Git</h1>\n</body>\n</html>' } }
      },
      branches: { 'main': 'c2', 'feature': 'c3' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'index.html': '<<<<<<< HEAD\n<html>\n<body>\n<h1>Hello World</h1>\n</body>\n</html>\n=======\n<html>\n<body>\n<h1>Hello Git</h1>\n</body>\n</html>\n>>>>>>> feature' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'command_executed',
      params: { command: 'status' }
    },
    hints: [
      '`git status` を実行します。',
      'Both modified として表示されます。'
    ]
  },
  {
    id: 'level-7-3',
    title: 'Level 7-3: コンフリクトの解消',
    description: 'ファイルを開いてコンフリクトを解消してください。',
    difficulty: 'advanced',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'index.html': '<html>\n<body>\n<h1>Hello</h1>\n</body>\n</html>' } },
        'c2': { id: 'c2', message: 'Update title to World', parents: ['c1'], timestamp: 200, author: 'User', changes: [], tree: { 'index.html': '<html>\n<body>\n<h1>Hello World</h1>\n</body>\n</html>' } },
        'c3': { id: 'c3', message: 'Update title to Git', parents: ['c1'], timestamp: 300, author: 'User', changes: [], tree: { 'index.html': '<html>\n<body>\n<h1>Hello Git</h1>\n</body>\n</html>' } }
      },
      branches: { 'main': 'c2', 'feature': 'c3' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'index.html': '<<<<<<< HEAD\n<html>\n<body>\n<h1>Hello World</h1>\n</body>\n</html>\n=======\n<html>\n<body>\n<h1>Hello Git</h1>\n</body>\n</html>\n>>>>>>> feature' },
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'file_modified', // コンフリクトマーカーが消えたか確認
      params: { name: 'index.html' }
    },
    hints: [
      '右側のファイルツリーから `index.html` をクリックします。',
      '「Resolve Conflict」画面でどちらか（または両方）を選択して解消します。'
    ]
  },
  {
    id: 'level-7-4',
    title: 'Level 7-4: マージの完了',
    description: 'コンフリクトを解消したら、ファイルをステージングしてコミットし、マージを完了させてください。',
    difficulty: 'advanced',
    initialState: {
      commits: {
        'c1': { id: 'c1', message: 'Initial commit', parents: [], timestamp: 100, author: 'User', changes: [], tree: { 'index.html': '<html>\n<body>\n<h1>Hello</h1>\n</body>\n</html>' } },
        'c2': { id: 'c2', message: 'Update title to World', parents: ['c1'], timestamp: 200, author: 'User', changes: [], tree: { 'index.html': '<html>\n<body>\n<h1>Hello World</h1>\n</body>\n</html>' } },
        'c3': { id: 'c3', message: 'Update title to Git', parents: ['c1'], timestamp: 300, author: 'User', changes: [], tree: { 'index.html': '<html>\n<body>\n<h1>Hello Git</h1>\n</body>\n</html>' } }
      },
      branches: { 'main': 'c2', 'feature': 'c3' },
      HEAD: { type: 'branch', value: 'main' },
      index: {},
      workingDirectory: { 'index.html': '<html>\n<body>\n<h1>Hello World</h1>\n</body>\n</html>' }, // Resolved
      detachedHead: false,
      stash: [],
      remotes: {},
      remoteBranches: {},
      mockServers: {}
    },
    goal: {
      type: 'merge_complete',
      params: { branch: 'main' }
    },
    hints: [
      '1. `git add index.html`',
      '2. `git commit` (メッセージは自動生成されることが多いですが、`-m "Merge feature"` としてもOK)'
    ]
  }
];
