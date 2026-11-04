import {
  shortestPath,
  mst,
  maxFlow,
  assignment,
  chromatic,
  components,
  spanningTrees,
  fiedler,
} from '@/features/calculator/math/graph';

const K4 = [
  [0, 1, 1, 1],
  [1, 0, 1, 1],
  [1, 1, 0, 1],
  [1, 1, 1, 0],
];
const C5 = [
  [0, 1, 0, 0, 1],
  [1, 0, 1, 0, 0],
  [0, 1, 0, 1, 0],
  [0, 0, 1, 0, 1],
  [1, 0, 0, 1, 0],
];

describe('shortestPath', () => {
  // CLRS Dijkstra example: s, t, x, y, z
  const W = [
    [0, 10, 0, 5, 0],
    [0, 0, 1, 2, 0],
    [0, 0, 0, 0, 4],
    [0, 3, 9, 0, 2],
    [7, 0, 6, 0, 0],
  ];

  it('uses Dijkstra on non-negative weights', () => {
    expect(shortestPath(W, 1, 3)).toEqual({ dist: 9, path: [1, 4, 2, 3] });
    expect(shortestPath(W, 1, 5)).toEqual({ dist: 7, path: [1, 4, 5] });
    expect(shortestPath(W, 2, 2)).toEqual({ dist: 0, path: [2] });
  });

  it('uses Bellman–Ford with negative weights', () => {
    const N = [
      [0, 4, 2, 0],
      [0, 0, 0, 2],
      [0, -1, 0, 6],
      [0, 0, 0, 0],
    ];
    expect(shortestPath(N, 1, 4)).toEqual({ dist: 3, path: [1, 3, 2, 4] });
    expect(() => shortestPath([[0, 1], [-2, 0]], 1, 2)).toThrow('Negative cycle');
  });

  it('reports unreachable vertices and bad indices', () => {
    expect(() => shortestPath([[0, 1], [0, 0]], 2, 1)).toThrow('No path from 2 to 1');
    expect(() => shortestPath([[0, Infinity], [Infinity, 0]], 1, 2)).toThrow('No path from 1 to 2');
    expect(() => shortestPath(K4, 0, 2)).toThrow('Vertex must be 1 to 4');
  });
});

describe('mst', () => {
  it('finds a minimum spanning tree', () => {
    const W = [
      [0, 2, 0, 6, 0],
      [2, 0, 3, 8, 5],
      [0, 3, 0, 0, 7],
      [6, 8, 0, 0, 9],
      [0, 5, 7, 9, 0],
    ];
    const { weight, edges } = mst(W);
    expect(weight).toBe(16);
    expect(edges).toEqual([
      [1, 2, 2],
      [2, 3, 3],
      [2, 5, 5],
      [1, 4, 6],
    ]);
  });

  it('needs a symmetric, connected graph', () => {
    expect(() => mst([[0, 1], [2, 0]])).toThrow('MST needs a symmetric matrix');
    expect(() => mst([[0, 0], [0, 0]])).toThrow('Graph is not connected');
  });
});

describe('maxFlow', () => {
  it('solves the CLRS network', () => {
    const C = [
      [0, 16, 13, 0, 0, 0],
      [0, 0, 10, 12, 0, 0],
      [0, 4, 0, 0, 14, 0],
      [0, 0, 9, 0, 0, 20],
      [0, 0, 0, 7, 0, 4],
      [0, 0, 0, 0, 0, 0],
    ];
    expect(maxFlow(C, 1, 6)).toBe(23);
    expect(maxFlow(C, 6, 1)).toBe(0);
    expect(() => maxFlow(C, 1, 1)).toThrow('Source and sink must differ');
  });
});

describe('assignment', () => {
  it('finds the cheapest assignment', () => {
    expect(assignment([[4, 1, 3], [2, 0, 5], [3, 2, 2]])).toEqual({ cost: 5, match: [2, 1, 3] });
    expect(assignment([[7]])).toEqual({ cost: 7, match: [1] });
    const W = [
      [9, 2, 7, 8],
      [6, 4, 3, 7],
      [5, 8, 1, 8],
      [7, 6, 9, 4],
    ];
    expect(assignment(W).cost).toBe(13);
  });
});

describe('chromatic', () => {
  it('colours textbook graphs', () => {
    expect(chromatic(K4).k).toBe(4);
    expect(chromatic(C5).k).toBe(3);
    expect(chromatic([[0, 0], [0, 0]]).k).toBe(1);
    // directed edge still counts
    const { k, colours } = chromatic([[0, 1, 0], [0, 0, 1], [0, 0, 0]]);
    expect(k).toBe(2);
    expect(colours[0]).not.toBe(colours[1]);
    expect(colours[1]).not.toBe(colours[2]);
  });

  it('gives a proper colouring', () => {
    const { colours } = chromatic(C5);
    C5.forEach((row, i) => row.forEach((a, j) => a && expect(colours[i]).not.toBe(colours[j])));
  });

  it('caps the size', () => {
    const big = Array.from({ length: 13 }, () => new Array(13).fill(0));
    expect(() => chromatic(big)).toThrow('Colouring needs ≤ 12 vertices');
  });
});

describe('components, spanningTrees, fiedler', () => {
  it('counts components', () => {
    expect(components(K4)).toBe(1);
    expect(components([[0, 1, 0], [0, 0, 0], [0, 0, 0]])).toBe(2);
    expect(components([[0, 0], [0, 0]])).toBe(2);
  });

  it('counts spanning trees', () => {
    expect(spanningTrees(K4)).toBe(16);
    expect(spanningTrees(C5)).toBe(5);
    expect(spanningTrees([[0, 0], [0, 0]])).toBe(0);
  });

  it('finds the algebraic connectivity', () => {
    expect(fiedler([[0, 1, 0], [1, 0, 1], [0, 1, 0]])).toBe(1);
    expect(fiedler(K4)).toBe(4);
    expect(fiedler([[0, 0], [0, 0]])).toBe(0);
  });
});
