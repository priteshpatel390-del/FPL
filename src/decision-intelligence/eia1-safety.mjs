import {secretFinding} from './canonical.mjs';

const SUPPLEMENTARY_SECRET_KEY=/^(?:api[-_]?token|(?:auth|access|refresh)[-_]?token|client[-_]?id)$/i;

function supplementarySecretFinding(value,path='$'){
  if(Array.isArray(value)){
    for(let index=0;index<value.length;index++){
      const found=supplementarySecretFinding(value[index],`${path}[${index}]`);
      if(found)return found;
    }
    return null;
  }
  if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){
    if(SUPPLEMENTARY_SECRET_KEY.test(key))return `${path}.${key}:secret_key`;
    const found=supplementarySecretFinding(child,`${path}.${key}`);
    if(found)return found;
  }
  return null;
}

export function eia1SecretFinding(value){
  return secretFinding(value)||supplementarySecretFinding(value);
}
