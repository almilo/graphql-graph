(function (globalScope, fetch, graphql, dagre) {
    globalScope.renderSchemaGraph = renderSchemaGraph;

    function renderSchemaGraph(graphqlEndpointUrlOrSchemaAst, graphIFrameElementOrSvgElementId) {
        assert(graphqlEndpointUrlOrSchemaAst, 'An GraphQL endpoint URL or a GraphQL Schema AST is required.');
        assert(graphIFrameElementOrSvgElementId, 'An iFrame element or the id of an SVG element is required.');

        var render = createGraphRenderer(graphIFrameElementOrSvgElementId);

        if (typeof graphqlEndpointUrlOrSchemaAst === 'string') {
            fetchSchemaAst(graphqlEndpointUrlOrSchemaAst).then(render);
        } else {
            render(graphqlEndpointUrlOrSchemaAst);
        }
    }

    function createGraphRenderer(graphIFrameElementOrSvgElementId) {
        return function render(schemaAst) {
            if (typeof graphIFrameElementOrSvgElementId === 'string') {
                renderGraphFromSchemaAst(graphIFrameElementOrSvgElementId, schemaAst);
            } else {
                var graphWindow = graphIFrameElementOrSvgElementId.contentWindow || graphIFrameElementOrSvgElementId;

                graphWindow.postMessage(schemaAst, graphIFrameElementOrSvgElementId.src);
            }
        };
    }

    function fetchSchemaAst(graphqlEndpointUrl) {
        assert(fetch, 'Fetch API is not available.');
        assert(graphql, 'GraphQL library is not available.');

        var introspectionSchemaRequest = {
            method: 'POST',
            headers: createHeaders(),
            body: JSON.stringify({query: graphql.introspectionQuery})
        };

        return fetch(graphqlEndpointUrl, introspectionSchemaRequest)
            .then(toJson)
            .then(toSchemaDocument)
            .then(toSchemaAst);

        function createHeaders() {
            var headers = new Headers();

            headers.append('accept', 'application/json');
            headers.append('content-type', 'application/json');

            return headers;
        }

        function toJson(response) {
            return response.json();
        }

        function toSchemaDocument(jsonResponse) {
            return graphql.buildClientSchema(jsonResponse.data);
        }

        function toSchemaAst(schemaDocument) {
            return graphql.parse(graphql.printSchema(schemaDocument));
        }
    }

    function renderGraphFromSchemaAst(elementId, schemaAst) {
        assert(graphql, 'GraphQL library is not available.');

        renderGraph(elementId, toGraph(schemaAst));

        function toGraph(schemaAst) {
            assert(dagre, 'Dagre library is not available.');

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

    function assert(value, errorMessage) {
        if (!value) {
            throw new Error(errorMessage);
        }
    }
})(window, window.fetch, window.graphql, window.dagre);
