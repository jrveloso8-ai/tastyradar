const ts = require('typescript');

function isNumberType(type) {
  if (!type) return false;
  // TypeFlags.Number = 8, TypeFlags.NumberLiteral = 512, TypeFlags.NumberLike = 520
  if (type.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) {
    return true;
  }
  // Se for uma união, checa se qualquer membro é number
  if (type.isUnion && type.isUnion()) {
    return type.types.some(t => isNumberType(t));
  }
  // Se for intersection
  if (type.isIntersection && type.isIntersection()) {
    return type.types.some(t => isNumberType(t));
  }
  return false;
}

module.exports = {
  'no-raw-numbers-in-jsx': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Proíbe interpolação de expressões do tipo number diretamente em JSX sem componente de proveniência (REGRA 00)',
        category: 'Possible Errors',
        recommended: true,
      },
      schema: [],
      messages: {
        rawNumberInJsx: 'REGRA 00: Proibido interpolar valor do tipo \'number\' diretamente em JSX. Use o componente estrutural <DataValue ... /> com proveniência e fonte obrigatórias, ou use // eslint-disable-next-line local-rules/no-raw-numbers-in-jsx -- <motivo> caso seja apenas rótulo visual/índice de UI.',
      },
    },
    create(context) {
      const filename = context.getFilename ? context.getFilename() : context.filename;
      if (filename && filename.includes('DataValue.tsx')) {
        return {};
      }

      const parserServices = context.sourceCode?.parserServices || context.parserServices;
      if (!parserServices || !parserServices.program || !parserServices.esTreeNodeToTSNodeMap) {
        return {};
      }

      const checker = parserServices.program.getTypeChecker();

      function checkExpression(node, targetNode) {
        try {
          const tsNode = parserServices.esTreeNodeToTSNodeMap.get(targetNode);
          if (!tsNode) return;

          const type = checker.getTypeAtLocation(tsNode);
          if (isNumberType(type)) {
            context.report({
              node: targetNode,
              messageId: 'rawNumberInJsx',
            });
          }
        } catch (e) {
          // Fallback silencioso caso AST do TS não mapeie o nó
        }
      }

      return {
        JSXExpressionContainer(node) {
          // Apenas verifica expressões que são filhos diretos de elementos ou fragmentos JSX
          // (não verifica atributos JSX como prop={123} ou width={400})
          if (node.parent.type !== 'JSXElement' && node.parent.type !== 'JSXFragment') {
            return;
          }

          const expr = node.expression;
          if (!expr || expr.type === 'JSXEmptyExpression') {
            return;
          }

          if (expr.type === 'TemplateLiteral') {
            // Verifica cada expressão interpolada dentro do template string
            expr.expressions.forEach((subExpr) => {
              checkExpression(node, subExpr);
            });
          } else {
            checkExpression(node, expr);
          }
        },
      };
    },
  },
};
