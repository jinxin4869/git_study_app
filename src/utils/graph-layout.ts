import { GitState, Commit } from '@/types/git';

export interface Node {
  id: string;
  x: number;
  y: number;
  commit: Commit;
}

export interface Link {
  source: Node;
  target: Node;
}

export function calculateGraphLayout(state: GitState): { nodes: Node[], links: Link[] } {
  const nodes: Node[] = [];
  const links: Link[] = [];
  
  // コミットをタイムスタンプ順にソート
  const commits = Object.values(state.commits).sort((a, b) => a.timestamp - b.timestamp);
  
  // レーン（Y軸）の割り当てロジック
  const lanes: Record<string, number> = {}; // commitId -> laneIndex
  const branchLanes: Record<string, number> = {}; // branchName -> laneIndex
  let nextLane = 0;

  // 1. mainブランチをレーン0に固定
  if (state.branches['main']) {
    branchLanes['main'] = 0;
    nextLane = 1;
  }

  // 2. 他のブランチにレーンを割り当て
  // 名前順でソートして決定論的にする
  Object.keys(state.branches).sort().forEach(branch => {
    if (branch !== 'main') {
      branchLanes[branch] = nextLane++;
    }
  });

  // 3. コミットにレーンを割り当て
  // ブランチのHEADから遡ってレーンを伝播させる
  const processBranch = (branchName: string) => {
    let currentId = state.branches[branchName];
    const lane = branchLanes[branchName];
    
    while (currentId) {
      if (lanes[currentId] !== undefined) {
        // 既にレーンが割り当てられている場合
        // mainレーン(0)は強いので上書きしない。
        // 現在のレーンの方が小さい（上にある）場合は更新しない（合流点）
        break; 
      }
      lanes[currentId] = lane;
      const commit = state.commits[currentId];
      if (!commit || commit.parents.length === 0) break;
      
      // 親へ移動。マージコミット（親が複数）の場合は、第一親を優先して同じレーンにする
      currentId = commit.parents[0];
    }
  };

  // mainを最初に処理
  if (state.branches['main']) processBranch('main');
  
  // 他のブランチを処理
  Object.keys(state.branches).sort().forEach(branch => {
    if (branch !== 'main') processBranch(branch);
  });

  // 4. まだレーンがないコミット（Detachedや削除されたブランチの残骸）は
  // 親のレーンを継承するか、新しいレーンを割り当てる
  commits.forEach(commit => {
    if (lanes[commit.id] === undefined) {
      if (commit.parents.length > 0 && lanes[commit.parents[0]] !== undefined) {
         lanes[commit.id] = lanes[commit.parents[0]];
      } else {
         lanes[commit.id] = nextLane; // 簡易的に新しいレーン
      }
    }
  });

  // ノードの生成
  commits.forEach((commit, index) => {
    const lane = lanes[commit.id] || 0;
    const node: Node = {
      id: commit.id,
      x: 50 + index * 80, // X間隔
      y: 50 + lane * 50,  // レーンごとにYをずらす
      commit
    };
    nodes.push(node);
  });

  // リンクの生成
  commits.forEach(commit => {
    const sourceNode = nodes.find(n => n.id === commit.id);
    if (!sourceNode) return;

    commit.parents.forEach(parentId => {
      const targetNode = nodes.find(n => n.id === parentId);
      if (targetNode) {
        links.push({ source: targetNode, target: sourceNode });
      }
    });
  });

  return { nodes, links };
}
