export default {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Prefer type aliases over interfaces for plain data shapes (no methods, no inheritance)',
        },
        messages: {
            preferType: 'Use a type alias instead of an interface for plain data shapes.',
        },
        schema: [],
    },
    create(context) {
        return {
            TSInterfaceDeclaration(node) {
                if (node.extends && node.extends.length > 0) {
                    return;
                }

                const hasBehavior = node.body.body.some(
                    (member) =>
                        member.type === 'TSMethodSignature' ||
                        member.type === 'TSCallSignatureDeclaration' ||
                        member.type === 'TSConstructSignatureDeclaration' ||
                        (member.type === 'TSPropertySignature' &&
                            (member.typeAnnotation?.typeAnnotation?.type === 'TSFunctionType' ||
                             member.typeAnnotation?.typeAnnotation?.type === 'TSTypeQuery'))
                );

                if (!hasBehavior) {
                    context.report({
                        node: node.id,
                        messageId: 'preferType',
                    });
                }
            },
        };
    },
};
