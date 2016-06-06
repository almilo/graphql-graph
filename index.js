function renderEndpointSchemaGraph(elementId, schemaAst) {
    renderGraph(elementId, toGraph(schemaAst));

    function toGraph(schemaAst) {
        var graph = new dagre.graphlib.Graph()
            .setGraph({})
            .setDefaultEdgeLabel(emptyObject)
            .setDefaultNodeLabel(emptyObject);

        graphql.visit(schemaAst, createGraphBuilderVisitor(graph));

        return graph;

        function emptyObject() {
            return {};
        }

        function createGraphBuilderVisitor(graph) {
            var ignoreTypesNames = [
                graphql.GraphQLBoolean.name,
                graphql.GraphQLFloat.name,
                graphql.GraphQLInt.name,
                graphql.GraphQLString.name,
                graphql.GraphQLID.name
            ];

            var currentParentTypeName;

            return {
                ObjectTypeDefinition: function (node) {
                    currentParentTypeName = node.name.value;
                    graph.setNode(currentParentTypeName, {label: currentParentTypeName});
                },
                FieldDefinition: function (node) {
                    switch (node.type.kind) {
                        case 'NamedType':
                            maybeAddRelation(node);
                            break;
                        case 'ListType':
                            maybeAddRelation(node, 's');
                            break;
                    }
                }
            };

            function maybeAddRelation(node, cardinality) {
                cardinality = cardinality || '';

                var fieldName = node.name.value, relatedTypeName = unwrapType(node).name.value;

                if (ignoreTypesNames.indexOf(relatedTypeName) === -1) {
                    var label = currentParentTypeName + ' ' + humanize(fieldName) + ' ' + relatedTypeName + cardinality;

                    graph.setEdge(currentParentTypeName, relatedTypeName, {label: label});
                }
            }
        }

        function unwrapType(typeNode) {
            if (!typeNode) {
                throw new Error('Cannot unwrap type!!');
            }

            return typeNode.kind === 'NamedType' ? typeNode : unwrapType(typeNode.type);
        }

        function humanize(camelCasedString) {
            return camelCasedString.replace(/([A-Z])/g, function (match) {
                return match.toLowerCase();
            });
        }
    }

    function renderGraph(elementId, graph) {
        var renderer = dagreD3.render(), svg = d3.select('#' + elementId), svgGroup = svg.append('g');

        renderer(d3.select('#' + elementId + ' g'), graph);

        svg.attr('width', graph.graph().width + 40);
        svg.attr('height', graph.graph().height + 40);
        svgGroup.attr('transform', 'translate(20, 20)');
    }
}
