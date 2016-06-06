function fetchClientSchemaAst(endpointUrl) {
    var introspectionSchemaRequest = {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify({query: graphql.introspectionQuery})
    };

    return fetch(endpointUrl, introspectionSchemaRequest)
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
