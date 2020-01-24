#!/usr/bin/env node

/**
  graph	:	[ strict ] (graph | digraph) [ ID ] '{' stmt_list '}'
  stmt_list	:	[ stmt [ ';' ] stmt_list ]
  stmt	:	node_stmt
  |	edge_stmt
  |	attr_stmt
  |	ID '=' ID
  |	subgraph
  attr_stmt	:	(graph | node | edge) attr_list
  attr_list	:	'[' [ a_list ] ']' [ attr_list ]
  a_list	:	ID '=' ID [ (';' | ',') ] [ a_list ]
  edge_stmt	:	(node_id | subgraph) edgeRHS [ attr_list ]
  edgeRHS	:	edgeop (node_id | subgraph) [ edgeRHS ]
  node_stmt	:	node_id [ attr_list ]
  node_id	:	ID [ port ]
  port	:	':' ID [ ':' compass_pt ]
  |	':' compass_pt
  subgraph	:	[ subgraph [ ID ] ] '{' stmt_list '}'
  compass_pt	:	(n | ne | e | se | s | sw | w | nw | c | _)
  Ref 1 - Dot Language: https://www.graphviz.org/doc/info/lang.html
  Ref 2 - XDOTJSON format: https://www.graphviz.org/doc/info/output.html#d:xdot_json
*/
const getStdIn = require('get-stdin');

const getStdInAsJSON = appliedFunction => {
  return getStdIn()
    .then(input => {
      const inputAsJSON = JSON.parse(input)
      return appliedFunction(inputAsJSON)
    })
}

// XDOT GRAPH UTILITY FUNCTIONS
const getName = item => {
  return item.name && item.name.substring(0, 1) !== "%"
            ? item.name
            : "";
}

const hasName = item => {
  return getName(item).length !== 0
}

const getItemsById = (itemList, itemIDs) => {
  return itemList && itemIDs
            ? itemList.filter(item => itemIDs.includes(item._gvid))
            : [];
}

const resolveEdge = (graph, edge) => {
  return  {
    ...edge,
    tail: getItemsById(graph.objects, [edge.tail])[0],
    head: getItemsById(graph.objects, [edge.head])[0]
  }
}

const getGraphItemIds = (graph, subgraphs) => {
  // Get all ids of subgraphs and nodes into a list.
  const allObjectIds = graph.objects.map(object => {
    return object._gvid;
  });

  // Get all ids of edges into a list.
  const allEdgeIds = graph.edges.map(edge => {
    return edge._gvid;
  })

  // Get all ids of subgraphs and nodes belonging to a subgraph into a list.
  const subgraphIds = subgraphs.map(subgraph => {
    return subgraph._gvid;
  })

  const subgraphNodeIds = subgraphs.map(subgraph => {
    return subgraph.nodes.map(node => {
      return node._gvid;
    })
  }).flat();

  const subgraphObjectIds = subgraphIds.concat(subgraphNodeIds);

  // Get all ids of edges belonging to a subgraph into a list.
  const subgraphEdgeIds = subgraphs.map(subgraph => {
    return subgraph.edges.map(edge => {
      return edge._gvid;
    })
  }).flat().sort((id1, id2) => id1 < id2);

  return {
    nodeIds: allObjectIds.filter(objectId => !subgraphObjectIds.includes(objectId)),
    edgeIds: allEdgeIds.filter(edgeId => !subgraphEdgeIds.includes(edgeId))
  };
}

const getGraphItems = (graph, graphItemIds) => {
  return {
    nodes: getItemsById(graph.objects, graphItemIds.nodeIds),
    edges: getItemsById(graph.edges, graphItemIds.edgeIds).map(edgeId => {
      return resolveEdge(graph, edgeId)
    })
  }
}

const getSubgraphs = graph => {
  const subgraphItems = graph.objects.slice(0, graph._subgraph_cnt);
  return subgraphItems.map(subgraphItem => {
    return {
      ...subgraphItem,
      nodes: getItemsById(graph.objects, subgraphItem.nodes),
      edges: getItemsById(graph.edges, subgraphItem.edges).map(edge => {
        // Resolve the tail and head nodes from the edge object.
        return resolveEdge(graph, edge)
      })
    }
  })
}

// GENERATE DOT
const generateGraphHeader = (name, directed, strict) => {
  return `${strict ? "strict " : "" }`
          +`${directed ? "digraph":"graph"}`
          +`${name}`
          +` {\n`
}

const generateSubgraphHeader = subgraph => {
  return `subgraph`
          + `${hasName(subgraph) ? ` ${subgraph.name}` : ''}`
          + ` {`
}

const generateSubgraphAttributes = subgraph => {
  return ``;
}

const generateSubgraphNodes = subgraph => {
  return `${
            subgraph.nodes.map(node => {
                return `\n\t\t${node.name}${generateNodeAttributes(node)}`;
            }).join("")
          }`;
}

const generateSubgraphEdges = subgraph => {
  return `${
      subgraph.edges.map(edge => {
        return `\n\t\t${edge.tail.name} -> ${edge.head.name}${generateEdgeAttributes(edge)}`
      })
    }`;
}

const generateSubgraph = subgraph => {
  return generateSubgraphHeader(subgraph)
          + generateSubgraphAttributes(subgraph)
          + generateSubgraphNodes(subgraph)
          + generateSubgraphEdges(subgraph)
          + `\n\t}`
}

const generateItemAttributes = (item, requiredFields, unsupportedFields, unacceptableFieldValues = {}) => {
  const attributesOutput =`[`
          + `${
                Object.keys(item).map(key => {
                  return !requiredFields.includes(key)
                          && !unsupportedFields.includes(key)
                          && (
                              !Object.keys(unacceptableFieldValues).includes(key)
                              || !unacceptableFieldValues[key].includes(item[key])
                             )
                          ? `${key}="${item[key]}"`
                          : "";
                }).filter(attribute => attribute != "").join(",")
            }`
          + `]`
  return attributesOutput == "[]" ? "" : attributesOutput;
}

const generateEdgeAttributes = edge => {
  const requiredFields = ['_gvid', 'tail', 'head'];
  const unsupportedFields = [
    '_hldraw_', '_tdraw_', '_draw_',
    '_ldraw_', '_gvid', '_tldraw_',
    '_hdraw_'
  ];

  return generateItemAttributes(edge, requiredFields, unsupportedFields);
}

const generateNodeAttributes = node => {
  const requiredFields = ['_gvid', 'name']
  const unsupportedFields = [
    '_draw_', '_ldraw_', '_gvid',
    'subgraphs', 'edges', 'nodes'
  ]
  const unacceptableFieldValues = {
    label: "\\N"
  }

  return generateItemAttributes(node, requiredFields, unsupportedFields, unacceptableFieldValues);
}


// MAIN CONVERSION FUNCTION.
const convert = graph => {
  let dotGraphOutput = ``;

  // Generate Graph Header
  dotGraphOutput += generateGraphHeader(getName(graph), graph.directed, graph.strict)

  // Generate Subgraphs
  let subgraphs = getSubgraphs(graph);
  subgraphs.forEach(subgraph => {
    dotGraphOutput += `\t` + generateSubgraph(subgraph) + `\n`;
  })

  // Generate Nodes & Edges
  const graphItemIds = getGraphItemIds(graph, subgraphs);
  const graphItems = getGraphItems(graph, graphItemIds);
  dotGraphOutput += graphItems.nodes.map(node => {
    return `\n\t${node.name}${generateNodeAttributes(node)}`
  }).join("");

  dotGraphOutput += graphItems.edges.map(edge => {
    return `\n\t${edge.tail.name} -> ${edge.head.name}${generateEdgeAttributes(edge)}`
  }).join("")

  // Close graph
  dotGraphOutput += `\n}`;
  return dotGraphOutput;
}

// Run the conversion and print to stdout.
getStdInAsJSON(convert)
  .then((result) => {
    console.log(result);
  })
