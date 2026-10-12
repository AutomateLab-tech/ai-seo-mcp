// Generate affected MCP output shapes from their owning TypeScript result types.
// Runtime constraints are preserved where they apply to real result fields.
import ts from 'typescript';
import path from 'node:path';
import fs from 'node:fs';
const root=path.resolve(import.meta.dirname,'..');
const config=ts.readConfigFile(path.join(root,'tsconfig.json'),ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
const program=ts.createProgram(parsed.fileNames,parsed.options);const checker=program.getTypeChecker();
const filename=path.join(root,'src/output-schemas.ts');const source=program.getSourceFile(filename);
const affected={checkSitemap:'checkSitemap',checkTechnical:'checkTechnical',auditSchema:'auditSchema',auditCanonical:'auditCanonical',scoreAiOverview:'scoreAiOverviewEligibility',scoreCitation:'scoreCitationWorthiness',validateLlmsTxt:'validateLlmsTxt',rewrite:'rewriteForAeo',extractEntities:'extractEntities'};
function schema(type,depth=0){
 if(depth>12)throw new Error('Recursive result type requires an explicit schema');
 if(type.isUnion()){
  const members=type.types;
  if(members.every(t=>t.flags&ts.TypeFlags.StringLiteral))return 'z.enum('+JSON.stringify(members.map(t=>t.value))+')';
  if(members.every(t=>t.flags&ts.TypeFlags.BooleanLiteral))return 'z.boolean()';
  return 'z.union(['+members.map(t=>schema(t,depth+1)).join(', ')+'])';
 }
 if(type.flags&ts.TypeFlags.StringLiteral)return 'z.literal('+JSON.stringify(type.value)+')';
 if(type.flags&ts.TypeFlags.NumberLiteral)return 'z.literal('+type.value+')';
 if(type.flags&ts.TypeFlags.BooleanLiteral)return 'z.literal('+type.intrinsicName+')';
 if(type.flags&ts.TypeFlags.String)return 'z.string()';
 if(type.flags&ts.TypeFlags.Number)return 'z.number()';
 if(type.flags&ts.TypeFlags.Boolean)return 'z.boolean()';
 if(type.flags&ts.TypeFlags.Null)return 'z.null()';
 if(type.flags&ts.TypeFlags.Undefined)return 'z.undefined()';
 if(type.flags&(ts.TypeFlags.Unknown|ts.TypeFlags.Any))return 'z.unknown()';
 if(checker.isArrayType(type))return 'z.array('+schema(checker.getTypeArguments(type)[0],depth+1)+')';
 const index=type.getStringIndexType();
 if(index)return 'z.record('+schema(index,depth+1)+')';
 const fields=type.getProperties().map(symbol=>{
  const declared=symbol.valueDeclaration||symbol.declarations[0];const value=checker.getTypeOfSymbolAtLocation(symbol,declared);
  return JSON.stringify(symbol.name)+': '+schema(value,depth+1)+(symbol.flags&ts.SymbolFlags.Optional?'.optional()':'');
 });
 return 'z.object({'+fields.join(', ')+'})';
}
let text=fs.readFileSync(filename,'utf8');const replacements=[];
for(const statement of source.statements){
 if(!ts.isVariableStatement(statement))continue;
 for(const declaration of statement.declarationList.declarations){
  const shape=declaration.name.getText();const key=shape.replace('OutputShape','');if(!affected[key])continue;
  const fn=affected[key];let result;
  for(const file of program.getSourceFiles().filter(file=>/[\\/]tools[\\/]/.test(file.fileName))){
   const symbol=checker.getSymbolAtLocation(file);if(!symbol)continue;const value=checker.getExportsOfModule(symbol).find(s=>s.name===fn);if(!value)continue;
   const signature=checker.getTypeOfSymbolAtLocation(value,file).getCallSignatures()[0];result=checker.getAwaitedType(signature.getReturnType());break;
  }
  if(!result)throw new Error('Missing owning result '+fn);
  const fields=result.getProperties().map(symbol=>{
   const declared=symbol.valueDeclaration||symbol.declarations[0];const value=checker.getTypeOfSymbolAtLocation(symbol,declared);
   let code=schema(value);if(symbol.name==='ai_citation_readiness_score')code='z.number().min(0).max(100)';
   return '  '+symbol.name+': '+code+(symbol.flags&ts.SymbolFlags.Optional?'.optional()':'')+',\n';
  });
  replacements.push({start:statement.getStart(),end:statement.getEnd(),text:'export const '+shape+' = {\n'+fields.join('')+'} as const;'});
 }
}
for(const change of replacements.sort((a,b)=>b.start-a.start))text=text.slice(0,change.start)+change.text+text.slice(change.end);
fs.writeFileSync(filename,text);
console.log('Reconciled '+replacements.length+' output shapes with owning result types.');
