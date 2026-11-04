(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))i(n);new MutationObserver(n=>{for(const r of n)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function e(n){const r={};return n.integrity&&(r.integrity=n.integrity),n.referrerPolicy&&(r.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?r.credentials="include":n.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(n){if(n.ep)return;n.ep=!0;const r=e(n);fetch(n.href,r)}})();/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Ro="170",tu=0,nl=1,eu=2,Nc=1,kc=2,xi=3,Oi=0,De=1,Re=2,Ni=0,Nn=1,$e=2,sl=3,rl=4,iu=5,Ji=100,nu=101,su=102,ru=103,au=104,ou=200,lu=201,cu=202,hu=203,Pa=204,Ia=205,uu=206,du=207,fu=208,pu=209,mu=210,gu=211,vu=212,xu=213,_u=214,Da=0,Ua=1,Na=2,Hn=3,ka=4,Oa=5,Fa=6,za=7,Oc=0,yu=1,Mu=2,ki=0,Su=1,bu=2,wu=3,Fc=4,Eu=5,Tu=6,Au=7,zc=300,Gn=301,Vn=302,Ba=303,Ha=304,Pr=306,br=1e3,tn=1001,Ga=1002,Oe=1003,Ru=1004,Os=1005,oi=1006,qr=1007,en=1008,Mi=1009,Bc=1010,Hc=1011,Ss=1012,Co=1013,sn=1014,li=1015,Is=1016,Lo=1017,Po=1018,Wn=1020,Gc=35902,Vc=1021,Wc=1022,Ke=1023,Xc=1024,qc=1025,kn=1026,Xn=1027,Io=1028,Do=1029,Yc=1030,Uo=1031,No=1033,gr=33776,vr=33777,xr=33778,_r=33779,Va=35840,Wa=35841,Xa=35842,qa=35843,Ya=36196,Ka=37492,$a=37496,ja=37808,Za=37809,Ja=37810,Qa=37811,to=37812,eo=37813,io=37814,no=37815,so=37816,ro=37817,ao=37818,oo=37819,lo=37820,co=37821,yr=36492,ho=36494,uo=36495,Kc=36283,fo=36284,po=36285,mo=36286,Cu=3200,Lu=3201,ko=0,Pu=1,Ui="",ze="srgb",Kn="srgb-linear",Ir="linear",re="srgb",pn=7680,al=519,Iu=512,Du=513,Uu=514,$c=515,Nu=516,ku=517,Ou=518,Fu=519,ol=35044,ll="300 es",_i=2e3,wr=2001;class $n{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const i=this._listeners;i[t]===void 0&&(i[t]=[]),i[t].indexOf(e)===-1&&i[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const i=this._listeners;return i[t]!==void 0&&i[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const n=this._listeners[t];if(n!==void 0){const r=n.indexOf(e);r!==-1&&n.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const i=this._listeners[t.type];if(i!==void 0){t.target=this;const n=i.slice(0);for(let r=0,a=n.length;r<a;r++)n[r].call(this,t);t.target=null}}}const Le=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let cl=1234567;const fs=Math.PI/180,bs=180/Math.PI;function hn(){const s=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Le[s&255]+Le[s>>8&255]+Le[s>>16&255]+Le[s>>24&255]+"-"+Le[t&255]+Le[t>>8&255]+"-"+Le[t>>16&15|64]+Le[t>>24&255]+"-"+Le[e&63|128]+Le[e>>8&255]+"-"+Le[e>>16&255]+Le[e>>24&255]+Le[i&255]+Le[i>>8&255]+Le[i>>16&255]+Le[i>>24&255]).toLowerCase()}function Te(s,t,e){return Math.max(t,Math.min(e,s))}function Oo(s,t){return(s%t+t)%t}function zu(s,t,e,i,n){return i+(s-t)*(n-i)/(e-t)}function Bu(s,t,e){return s!==t?(e-s)/(t-s):0}function ps(s,t,e){return(1-e)*s+e*t}function Hu(s,t,e,i){return ps(s,t,1-Math.exp(-e*i))}function Gu(s,t=1){return t-Math.abs(Oo(s,t*2)-t)}function Vu(s,t,e){return s<=t?0:s>=e?1:(s=(s-t)/(e-t),s*s*(3-2*s))}function Wu(s,t,e){return s<=t?0:s>=e?1:(s=(s-t)/(e-t),s*s*s*(s*(s*6-15)+10))}function Xu(s,t){return s+Math.floor(Math.random()*(t-s+1))}function qu(s,t){return s+Math.random()*(t-s)}function Yu(s){return s*(.5-Math.random())}function Ku(s){s!==void 0&&(cl=s);let t=cl+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function $u(s){return s*fs}function ju(s){return s*bs}function Zu(s){return(s&s-1)===0&&s!==0}function Ju(s){return Math.pow(2,Math.ceil(Math.log(s)/Math.LN2))}function Qu(s){return Math.pow(2,Math.floor(Math.log(s)/Math.LN2))}function td(s,t,e,i,n){const r=Math.cos,a=Math.sin,o=r(e/2),l=a(e/2),c=r((t+i)/2),h=a((t+i)/2),u=r((t-i)/2),d=a((t-i)/2),p=r((i-t)/2),g=a((i-t)/2);switch(n){case"XYX":s.set(o*h,l*u,l*d,o*c);break;case"YZY":s.set(l*d,o*h,l*u,o*c);break;case"ZXZ":s.set(l*u,l*d,o*h,o*c);break;case"XZX":s.set(o*h,l*g,l*p,o*c);break;case"YXY":s.set(l*p,o*h,l*g,o*c);break;case"ZYZ":s.set(l*g,l*p,o*h,o*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+n)}}function Cn(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("Invalid component type.")}}function Ne(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("Invalid component type.")}}const ed={DEG2RAD:fs,RAD2DEG:bs,generateUUID:hn,clamp:Te,euclideanModulo:Oo,mapLinear:zu,inverseLerp:Bu,lerp:ps,damp:Hu,pingpong:Gu,smoothstep:Vu,smootherstep:Wu,randInt:Xu,randFloat:qu,randFloatSpread:Yu,seededRandom:Ku,degToRad:$u,radToDeg:ju,isPowerOfTwo:Zu,ceilPowerOfTwo:Ju,floorPowerOfTwo:Qu,setQuaternionFromProperEuler:td,normalize:Ne,denormalize:Cn};class lt{constructor(t=0,e=0){lt.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,i=this.y,n=t.elements;return this.x=n[0]*e+n[3]*i+n[6],this.y=n[1]*e+n[4]*i+n[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const i=this.dot(t)/e;return Math.acos(Te(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,i=this.y-t.y;return e*e+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const i=Math.cos(e),n=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*i-a*n+t.x,this.y=r*n+a*i+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Vt{constructor(t,e,i,n,r,a,o,l,c){Vt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,i,n,r,a,o,l,c)}set(t,e,i,n,r,a,o,l,c){const h=this.elements;return h[0]=t,h[1]=n,h[2]=o,h[3]=e,h[4]=r,h[5]=l,h[6]=i,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],this}extractBasis(t,e,i){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const i=t.elements,n=e.elements,r=this.elements,a=i[0],o=i[3],l=i[6],c=i[1],h=i[4],u=i[7],d=i[2],p=i[5],g=i[8],v=n[0],m=n[3],f=n[6],M=n[1],y=n[4],x=n[7],I=n[2],A=n[5],C=n[8];return r[0]=a*v+o*M+l*I,r[3]=a*m+o*y+l*A,r[6]=a*f+o*x+l*C,r[1]=c*v+h*M+u*I,r[4]=c*m+h*y+u*A,r[7]=c*f+h*x+u*C,r[2]=d*v+p*M+g*I,r[5]=d*m+p*y+g*A,r[8]=d*f+p*x+g*C,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],i=t[1],n=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return e*a*h-e*o*c-i*r*h+i*o*l+n*r*c-n*a*l}invert(){const t=this.elements,e=t[0],i=t[1],n=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=h*a-o*c,d=o*l-h*r,p=c*r-a*l,g=e*u+i*d+n*p;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const v=1/g;return t[0]=u*v,t[1]=(n*c-h*i)*v,t[2]=(o*i-n*a)*v,t[3]=d*v,t[4]=(h*e-n*l)*v,t[5]=(n*r-o*e)*v,t[6]=p*v,t[7]=(i*l-c*e)*v,t[8]=(a*e-i*r)*v,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,i,n,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(i*l,i*c,-i*(l*a+c*o)+a+t,-n*c,n*l,-n*(-c*a+l*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(Yr.makeScale(t,e)),this}rotate(t){return this.premultiply(Yr.makeRotation(-t)),this}translate(t,e){return this.premultiply(Yr.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),i=Math.sin(t);return this.set(e,-i,0,i,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,i=t.elements;for(let n=0;n<9;n++)if(e[n]!==i[n])return!1;return!0}fromArray(t,e=0){for(let i=0;i<9;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){const i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const Yr=new Vt;function jc(s){for(let t=s.length-1;t>=0;--t)if(s[t]>=65535)return!0;return!1}function Er(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function id(){const s=Er("canvas");return s.style.display="block",s}const hl={};function us(s){s in hl||(hl[s]=!0,console.warn(s))}function nd(s,t,e){return new Promise(function(i,n){function r(){switch(s.clientWaitSync(t,s.SYNC_FLUSH_COMMANDS_BIT,0)){case s.WAIT_FAILED:n();break;case s.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:i()}}setTimeout(r,e)})}function sd(s){const t=s.elements;t[2]=.5*t[2]+.5*t[3],t[6]=.5*t[6]+.5*t[7],t[10]=.5*t[10]+.5*t[11],t[14]=.5*t[14]+.5*t[15]}function rd(s){const t=s.elements;t[11]===-1?(t[10]=-t[10]-1,t[14]=-t[14]):(t[10]=-t[10],t[14]=-t[14]+1)}const Jt={enabled:!0,workingColorSpace:Kn,spaces:{},convert:function(s,t,e){return this.enabled===!1||t===e||!t||!e||(this.spaces[t].transfer===re&&(s.r=yi(s.r),s.g=yi(s.g),s.b=yi(s.b)),this.spaces[t].primaries!==this.spaces[e].primaries&&(s.applyMatrix3(this.spaces[t].toXYZ),s.applyMatrix3(this.spaces[e].fromXYZ)),this.spaces[e].transfer===re&&(s.r=On(s.r),s.g=On(s.g),s.b=On(s.b))),s},fromWorkingColorSpace:function(s,t){return this.convert(s,this.workingColorSpace,t)},toWorkingColorSpace:function(s,t){return this.convert(s,t,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Ui?Ir:this.spaces[s].transfer},getLuminanceCoefficients:function(s,t=this.workingColorSpace){return s.fromArray(this.spaces[t].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,t,e){return s.copy(this.spaces[t].toXYZ).multiply(this.spaces[e].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace}};function yi(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function On(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}const ul=[.64,.33,.3,.6,.15,.06],dl=[.2126,.7152,.0722],fl=[.3127,.329],pl=new Vt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),ml=new Vt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);Jt.define({[Kn]:{primaries:ul,whitePoint:fl,transfer:Ir,toXYZ:pl,fromXYZ:ml,luminanceCoefficients:dl,workingColorSpaceConfig:{unpackColorSpace:ze},outputColorSpaceConfig:{drawingBufferColorSpace:ze}},[ze]:{primaries:ul,whitePoint:fl,transfer:re,toXYZ:pl,fromXYZ:ml,luminanceCoefficients:dl,outputColorSpaceConfig:{drawingBufferColorSpace:ze}}});let mn;class ad{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{mn===void 0&&(mn=Er("canvas")),mn.width=t.width,mn.height=t.height;const i=mn.getContext("2d");t instanceof ImageData?i.putImageData(t,0,0):i.drawImage(t,0,0,t.width,t.height),e=mn}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=Er("canvas");e.width=t.width,e.height=t.height;const i=e.getContext("2d");i.drawImage(t,0,0,t.width,t.height);const n=i.getImageData(0,0,t.width,t.height),r=n.data;for(let a=0;a<r.length;a++)r[a]=yi(r[a]/255)*255;return i.putImageData(n,0,0),e}else if(t.data){const e=t.data.slice(0);for(let i=0;i<e.length;i++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[i]=Math.floor(yi(e[i]/255)*255):e[i]=yi(e[i]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let od=0;class Zc{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:od++}),this.uuid=hn(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const i={uuid:this.uuid,url:""},n=this.data;if(n!==null){let r;if(Array.isArray(n)){r=[];for(let a=0,o=n.length;a<o;a++)n[a].isDataTexture?r.push(Kr(n[a].image)):r.push(Kr(n[a]))}else r=Kr(n);i.url=r}return e||(t.images[this.uuid]=i),i}}function Kr(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?ad.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let ld=0;class Ue extends $n{constructor(t=Ue.DEFAULT_IMAGE,e=Ue.DEFAULT_MAPPING,i=tn,n=tn,r=oi,a=en,o=Ke,l=Mi,c=Ue.DEFAULT_ANISOTROPY,h=Ui){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:ld++}),this.uuid=hn(),this.name="",this.source=new Zc(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=i,this.wrapT=n,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new lt(0,0),this.repeat=new lt(1,1),this.center=new lt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Vt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const i={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),e||(t.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==zc)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case br:t.x=t.x-Math.floor(t.x);break;case tn:t.x=t.x<0?0:1;break;case Ga:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case br:t.y=t.y-Math.floor(t.y);break;case tn:t.y=t.y<0?0:1;break;case Ga:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}Ue.DEFAULT_IMAGE=null;Ue.DEFAULT_MAPPING=zc;Ue.DEFAULT_ANISOTROPY=1;class ae{constructor(t=0,e=0,i=0,n=1){ae.prototype.isVector4=!0,this.x=t,this.y=e,this.z=i,this.w=n}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,i,n){return this.x=t,this.y=e,this.z=i,this.w=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,i=this.y,n=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*i+a[8]*n+a[12]*r,this.y=a[1]*e+a[5]*i+a[9]*n+a[13]*r,this.z=a[2]*e+a[6]*i+a[10]*n+a[14]*r,this.w=a[3]*e+a[7]*i+a[11]*n+a[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,i,n,r;const l=t.elements,c=l[0],h=l[4],u=l[8],d=l[1],p=l[5],g=l[9],v=l[2],m=l[6],f=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-v)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+v)<.1&&Math.abs(g+m)<.1&&Math.abs(c+p+f-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const y=(c+1)/2,x=(p+1)/2,I=(f+1)/2,A=(h+d)/4,C=(u+v)/4,P=(g+m)/4;return y>x&&y>I?y<.01?(i=0,n=.707106781,r=.707106781):(i=Math.sqrt(y),n=A/i,r=C/i):x>I?x<.01?(i=.707106781,n=0,r=.707106781):(n=Math.sqrt(x),i=A/n,r=P/n):I<.01?(i=.707106781,n=.707106781,r=0):(r=Math.sqrt(I),i=C/r,n=P/r),this.set(i,n,r,e),this}let M=Math.sqrt((m-g)*(m-g)+(u-v)*(u-v)+(d-h)*(d-h));return Math.abs(M)<.001&&(M=1),this.x=(m-g)/M,this.y=(u-v)/M,this.z=(d-h)/M,this.w=Math.acos((c+p+f-1)/2),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this.w=t.w+(e.w-t.w)*i,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class cd extends $n{constructor(t=1,e=1,i={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new ae(0,0,t,e),this.scissorTest=!1,this.viewport=new ae(0,0,t,e);const n={width:t,height:e,depth:1};i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:oi,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},i);const r=new Ue(n,i.mapping,i.wrapS,i.wrapT,i.magFilter,i.minFilter,i.format,i.type,i.anisotropy,i.colorSpace);r.flipY=!1,r.generateMipmaps=i.generateMipmaps,r.internalFormat=i.internalFormat,this.textures=[];const a=i.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0;this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this.depthTexture=i.depthTexture,this.samples=i.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,i=1){if(this.width!==t||this.height!==e||this.depth!==i){this.width=t,this.height=e,this.depth=i;for(let n=0,r=this.textures.length;n<r;n++)this.textures[n].image.width=t,this.textures[n].image.height=e,this.textures[n].image.depth=i;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let i=0,n=t.textures.length;i<n;i++)this.textures[i]=t.textures[i].clone(),this.textures[i].isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new Zc(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class rn extends cd{constructor(t=1,e=1,i={}){super(t,e,i),this.isWebGLRenderTarget=!0}}class Jc extends Ue{constructor(t=null,e=1,i=1,n=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:i,depth:n},this.magFilter=Oe,this.minFilter=Oe,this.wrapR=tn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class hd extends Ue{constructor(t=null,e=1,i=1,n=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:i,depth:n},this.magFilter=Oe,this.minFilter=Oe,this.wrapR=tn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Ds{constructor(t=0,e=0,i=0,n=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=i,this._w=n}static slerpFlat(t,e,i,n,r,a,o){let l=i[n+0],c=i[n+1],h=i[n+2],u=i[n+3];const d=r[a+0],p=r[a+1],g=r[a+2],v=r[a+3];if(o===0){t[e+0]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u;return}if(o===1){t[e+0]=d,t[e+1]=p,t[e+2]=g,t[e+3]=v;return}if(u!==v||l!==d||c!==p||h!==g){let m=1-o;const f=l*d+c*p+h*g+u*v,M=f>=0?1:-1,y=1-f*f;if(y>Number.EPSILON){const I=Math.sqrt(y),A=Math.atan2(I,f*M);m=Math.sin(m*A)/I,o=Math.sin(o*A)/I}const x=o*M;if(l=l*m+d*x,c=c*m+p*x,h=h*m+g*x,u=u*m+v*x,m===1-o){const I=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=I,c*=I,h*=I,u*=I}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,i,n,r,a){const o=i[n],l=i[n+1],c=i[n+2],h=i[n+3],u=r[a],d=r[a+1],p=r[a+2],g=r[a+3];return t[e]=o*g+h*u+l*p-c*d,t[e+1]=l*g+h*d+c*u-o*p,t[e+2]=c*g+h*p+o*d-l*u,t[e+3]=h*g-o*u-l*d-c*p,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,i,n){return this._x=t,this._y=e,this._z=i,this._w=n,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const i=t._x,n=t._y,r=t._z,a=t._order,o=Math.cos,l=Math.sin,c=o(i/2),h=o(n/2),u=o(r/2),d=l(i/2),p=l(n/2),g=l(r/2);switch(a){case"XYZ":this._x=d*h*u+c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u-d*p*g;break;case"YXZ":this._x=d*h*u+c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u+d*p*g;break;case"ZXY":this._x=d*h*u-c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u-d*p*g;break;case"ZYX":this._x=d*h*u-c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u+d*p*g;break;case"YZX":this._x=d*h*u+c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u-d*p*g;break;case"XZY":this._x=d*h*u-c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u+d*p*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const i=e/2,n=Math.sin(i);return this._x=t.x*n,this._y=t.y*n,this._z=t.z*n,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,i=e[0],n=e[4],r=e[8],a=e[1],o=e[5],l=e[9],c=e[2],h=e[6],u=e[10],d=i+o+u;if(d>0){const p=.5/Math.sqrt(d+1);this._w=.25/p,this._x=(h-l)*p,this._y=(r-c)*p,this._z=(a-n)*p}else if(i>o&&i>u){const p=2*Math.sqrt(1+i-o-u);this._w=(h-l)/p,this._x=.25*p,this._y=(n+a)/p,this._z=(r+c)/p}else if(o>u){const p=2*Math.sqrt(1+o-i-u);this._w=(r-c)/p,this._x=(n+a)/p,this._y=.25*p,this._z=(l+h)/p}else{const p=2*Math.sqrt(1+u-i-o);this._w=(a-n)/p,this._x=(r+c)/p,this._y=(l+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let i=t.dot(e)+1;return i<Number.EPSILON?(i=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=i):(this._x=0,this._y=-t.z,this._z=t.y,this._w=i)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=i),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Te(this.dot(t),-1,1)))}rotateTowards(t,e){const i=this.angleTo(t);if(i===0)return this;const n=Math.min(1,e/i);return this.slerp(t,n),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const i=t._x,n=t._y,r=t._z,a=t._w,o=e._x,l=e._y,c=e._z,h=e._w;return this._x=i*h+a*o+n*c-r*l,this._y=n*h+a*l+r*o-i*c,this._z=r*h+a*c+i*l-n*o,this._w=a*h-i*o-n*l-r*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const i=this._x,n=this._y,r=this._z,a=this._w;let o=a*t._w+i*t._x+n*t._y+r*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=a,this._x=i,this._y=n,this._z=r,this;const l=1-o*o;if(l<=Number.EPSILON){const p=1-e;return this._w=p*a+e*this._w,this._x=p*i+e*this._x,this._y=p*n+e*this._y,this._z=p*r+e*this._z,this.normalize(),this}const c=Math.sqrt(l),h=Math.atan2(c,o),u=Math.sin((1-e)*h)/c,d=Math.sin(e*h)/c;return this._w=a*u+this._w*d,this._x=i*u+this._x*d,this._y=n*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,i){return this.copy(t).slerp(e,i)}random(){const t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),i=Math.random(),n=Math.sqrt(1-i),r=Math.sqrt(i);return this.set(n*Math.sin(t),n*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class R{constructor(t=0,e=0,i=0){R.prototype.isVector3=!0,this.x=t,this.y=e,this.z=i}set(t,e,i){return i===void 0&&(i=this.z),this.x=t,this.y=e,this.z=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(gl.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(gl.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,i=this.y,n=this.z,r=t.elements;return this.x=r[0]*e+r[3]*i+r[6]*n,this.y=r[1]*e+r[4]*i+r[7]*n,this.z=r[2]*e+r[5]*i+r[8]*n,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,i=this.y,n=this.z,r=t.elements,a=1/(r[3]*e+r[7]*i+r[11]*n+r[15]);return this.x=(r[0]*e+r[4]*i+r[8]*n+r[12])*a,this.y=(r[1]*e+r[5]*i+r[9]*n+r[13])*a,this.z=(r[2]*e+r[6]*i+r[10]*n+r[14])*a,this}applyQuaternion(t){const e=this.x,i=this.y,n=this.z,r=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*n-o*i),h=2*(o*e-r*n),u=2*(r*i-a*e);return this.x=e+l*c+a*u-o*h,this.y=i+l*h+o*c-r*u,this.z=n+l*u+r*h-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,i=this.y,n=this.z,r=t.elements;return this.x=r[0]*e+r[4]*i+r[8]*n,this.y=r[1]*e+r[5]*i+r[9]*n,this.z=r[2]*e+r[6]*i+r[10]*n,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const i=t.x,n=t.y,r=t.z,a=e.x,o=e.y,l=e.z;return this.x=n*l-r*o,this.y=r*a-i*l,this.z=i*o-n*a,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const i=t.dot(this)/e;return this.copy(t).multiplyScalar(i)}projectOnPlane(t){return $r.copy(this).projectOnVector(t),this.sub($r)}reflect(t){return this.sub($r.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const i=this.dot(t)/e;return Math.acos(Te(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,i=this.y-t.y,n=this.z-t.z;return e*e+i*i+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,i){const n=Math.sin(e)*t;return this.x=n*Math.sin(i),this.y=Math.cos(e)*t,this.z=n*Math.cos(i),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,i){return this.x=t*Math.sin(e),this.y=i,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),i=this.setFromMatrixColumn(t,1).length(),n=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=i,this.z=n,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,e=Math.random()*2-1,i=Math.sqrt(1-e*e);return this.x=i*Math.cos(t),this.y=e,this.z=i*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const $r=new R,gl=new Ds;class un{constructor(t=new R(1/0,1/0,1/0),e=new R(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,i=t.length;e<i;e+=3)this.expandByPoint(Qe.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,i=t.count;e<i;e++)this.expandByPoint(Qe.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,i=t.length;e<i;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const i=Qe.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(i),this.max.copy(t).add(i),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const i=t.geometry;if(i!==void 0){const r=i.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,Qe):Qe.fromBufferAttribute(r,a),Qe.applyMatrix4(t.matrixWorld),this.expandByPoint(Qe);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Fs.copy(t.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),Fs.copy(i.boundingBox)),Fs.applyMatrix4(t.matrixWorld),this.union(Fs)}const n=t.children;for(let r=0,a=n.length;r<a;r++)this.expandByObject(n[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,Qe),Qe.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,i;return t.normal.x>0?(e=t.normal.x*this.min.x,i=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,i=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,i+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,i+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,i+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,i+=t.normal.z*this.min.z),e<=-t.constant&&i>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(es),zs.subVectors(this.max,es),gn.subVectors(t.a,es),vn.subVectors(t.b,es),xn.subVectors(t.c,es),Ti.subVectors(vn,gn),Ai.subVectors(xn,vn),Gi.subVectors(gn,xn);let e=[0,-Ti.z,Ti.y,0,-Ai.z,Ai.y,0,-Gi.z,Gi.y,Ti.z,0,-Ti.x,Ai.z,0,-Ai.x,Gi.z,0,-Gi.x,-Ti.y,Ti.x,0,-Ai.y,Ai.x,0,-Gi.y,Gi.x,0];return!jr(e,gn,vn,xn,zs)||(e=[1,0,0,0,1,0,0,0,1],!jr(e,gn,vn,xn,zs))?!1:(Bs.crossVectors(Ti,Ai),e=[Bs.x,Bs.y,Bs.z],jr(e,gn,vn,xn,zs))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,Qe).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(Qe).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(fi[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),fi[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),fi[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),fi[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),fi[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),fi[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),fi[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),fi[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(fi),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const fi=[new R,new R,new R,new R,new R,new R,new R,new R],Qe=new R,Fs=new un,gn=new R,vn=new R,xn=new R,Ti=new R,Ai=new R,Gi=new R,es=new R,zs=new R,Bs=new R,Vi=new R;function jr(s,t,e,i,n){for(let r=0,a=s.length-3;r<=a;r+=3){Vi.fromArray(s,r);const o=n.x*Math.abs(Vi.x)+n.y*Math.abs(Vi.y)+n.z*Math.abs(Vi.z),l=t.dot(Vi),c=e.dot(Vi),h=i.dot(Vi);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}const ud=new un,is=new R,Zr=new R;class dn{constructor(t=new R,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const i=this.center;e!==void 0?i.copy(e):ud.setFromPoints(t).getCenter(i);let n=0;for(let r=0,a=t.length;r<a;r++)n=Math.max(n,i.distanceToSquared(t[r]));return this.radius=Math.sqrt(n),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const i=this.center.distanceToSquared(t);return e.copy(t),i>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;is.subVectors(t,this.center);const e=is.lengthSq();if(e>this.radius*this.radius){const i=Math.sqrt(e),n=(i-this.radius)*.5;this.center.addScaledVector(is,n/i),this.radius+=n}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Zr.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(is.copy(t.center).add(Zr)),this.expandByPoint(is.copy(t.center).sub(Zr))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const pi=new R,Jr=new R,Hs=new R,Ri=new R,Qr=new R,Gs=new R,ta=new R;class Fo{constructor(t=new R,e=new R(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,pi)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const i=e.dot(this.direction);return i<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=pi.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(pi.copy(this.origin).addScaledVector(this.direction,e),pi.distanceToSquared(t))}distanceSqToSegment(t,e,i,n){Jr.copy(t).add(e).multiplyScalar(.5),Hs.copy(e).sub(t).normalize(),Ri.copy(this.origin).sub(Jr);const r=t.distanceTo(e)*.5,a=-this.direction.dot(Hs),o=Ri.dot(this.direction),l=-Ri.dot(Hs),c=Ri.lengthSq(),h=Math.abs(1-a*a);let u,d,p,g;if(h>0)if(u=a*l-o,d=a*o-l,g=r*h,u>=0)if(d>=-g)if(d<=g){const v=1/h;u*=v,d*=v,p=u*(u+a*d+2*o)+d*(a*u+d+2*l)+c}else d=r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d=-r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;else d<=-g?(u=Math.max(0,-(-a*r+o)),d=u>0?-r:Math.min(Math.max(-r,-l),r),p=-u*u+d*(d+2*l)+c):d<=g?(u=0,d=Math.min(Math.max(-r,-l),r),p=d*(d+2*l)+c):(u=Math.max(0,-(a*r+o)),d=u>0?r:Math.min(Math.max(-r,-l),r),p=-u*u+d*(d+2*l)+c);else d=a>0?-r:r,u=Math.max(0,-(a*d+o)),p=-u*u+d*(d+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,u),n&&n.copy(Jr).addScaledVector(Hs,d),p}intersectSphere(t,e){pi.subVectors(t.center,this.origin);const i=pi.dot(this.direction),n=pi.dot(pi)-i*i,r=t.radius*t.radius;if(n>r)return null;const a=Math.sqrt(r-n),o=i-a,l=i+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const i=-(this.origin.dot(t.normal)+t.constant)/e;return i>=0?i:null}intersectPlane(t,e){const i=this.distanceToPlane(t);return i===null?null:this.at(i,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let i,n,r,a,o,l;const c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(i=(t.min.x-d.x)*c,n=(t.max.x-d.x)*c):(i=(t.max.x-d.x)*c,n=(t.min.x-d.x)*c),h>=0?(r=(t.min.y-d.y)*h,a=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,a=(t.min.y-d.y)*h),i>a||r>n||((r>i||isNaN(i))&&(i=r),(a<n||isNaN(n))&&(n=a),u>=0?(o=(t.min.z-d.z)*u,l=(t.max.z-d.z)*u):(o=(t.max.z-d.z)*u,l=(t.min.z-d.z)*u),i>l||o>n)||((o>i||i!==i)&&(i=o),(l<n||n!==n)&&(n=l),n<0)?null:this.at(i>=0?i:n,e)}intersectsBox(t){return this.intersectBox(t,pi)!==null}intersectTriangle(t,e,i,n,r){Qr.subVectors(e,t),Gs.subVectors(i,t),ta.crossVectors(Qr,Gs);let a=this.direction.dot(ta),o;if(a>0){if(n)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Ri.subVectors(this.origin,t);const l=o*this.direction.dot(Gs.crossVectors(Ri,Gs));if(l<0)return null;const c=o*this.direction.dot(Qr.cross(Ri));if(c<0||l+c>a)return null;const h=-o*Ri.dot(ta);return h<0?null:this.at(h/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class se{constructor(t,e,i,n,r,a,o,l,c,h,u,d,p,g,v,m){se.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,i,n,r,a,o,l,c,h,u,d,p,g,v,m)}set(t,e,i,n,r,a,o,l,c,h,u,d,p,g,v,m){const f=this.elements;return f[0]=t,f[4]=e,f[8]=i,f[12]=n,f[1]=r,f[5]=a,f[9]=o,f[13]=l,f[2]=c,f[6]=h,f[10]=u,f[14]=d,f[3]=p,f[7]=g,f[11]=v,f[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new se().fromArray(this.elements)}copy(t){const e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],e[9]=i[9],e[10]=i[10],e[11]=i[11],e[12]=i[12],e[13]=i[13],e[14]=i[14],e[15]=i[15],this}copyPosition(t){const e=this.elements,i=t.elements;return e[12]=i[12],e[13]=i[13],e[14]=i[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,i){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this}makeBasis(t,e,i){return this.set(t.x,e.x,i.x,0,t.y,e.y,i.y,0,t.z,e.z,i.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,i=t.elements,n=1/_n.setFromMatrixColumn(t,0).length(),r=1/_n.setFromMatrixColumn(t,1).length(),a=1/_n.setFromMatrixColumn(t,2).length();return e[0]=i[0]*n,e[1]=i[1]*n,e[2]=i[2]*n,e[3]=0,e[4]=i[4]*r,e[5]=i[5]*r,e[6]=i[6]*r,e[7]=0,e[8]=i[8]*a,e[9]=i[9]*a,e[10]=i[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,i=t.x,n=t.y,r=t.z,a=Math.cos(i),o=Math.sin(i),l=Math.cos(n),c=Math.sin(n),h=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){const d=a*h,p=a*u,g=o*h,v=o*u;e[0]=l*h,e[4]=-l*u,e[8]=c,e[1]=p+g*c,e[5]=d-v*c,e[9]=-o*l,e[2]=v-d*c,e[6]=g+p*c,e[10]=a*l}else if(t.order==="YXZ"){const d=l*h,p=l*u,g=c*h,v=c*u;e[0]=d+v*o,e[4]=g*o-p,e[8]=a*c,e[1]=a*u,e[5]=a*h,e[9]=-o,e[2]=p*o-g,e[6]=v+d*o,e[10]=a*l}else if(t.order==="ZXY"){const d=l*h,p=l*u,g=c*h,v=c*u;e[0]=d-v*o,e[4]=-a*u,e[8]=g+p*o,e[1]=p+g*o,e[5]=a*h,e[9]=v-d*o,e[2]=-a*c,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){const d=a*h,p=a*u,g=o*h,v=o*u;e[0]=l*h,e[4]=g*c-p,e[8]=d*c+v,e[1]=l*u,e[5]=v*c+d,e[9]=p*c-g,e[2]=-c,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){const d=a*l,p=a*c,g=o*l,v=o*c;e[0]=l*h,e[4]=v-d*u,e[8]=g*u+p,e[1]=u,e[5]=a*h,e[9]=-o*h,e[2]=-c*h,e[6]=p*u+g,e[10]=d-v*u}else if(t.order==="XZY"){const d=a*l,p=a*c,g=o*l,v=o*c;e[0]=l*h,e[4]=-u,e[8]=c*h,e[1]=d*u+v,e[5]=a*h,e[9]=p*u-g,e[2]=g*u-p,e[6]=o*h,e[10]=v*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(dd,t,fd)}lookAt(t,e,i){const n=this.elements;return He.subVectors(t,e),He.lengthSq()===0&&(He.z=1),He.normalize(),Ci.crossVectors(i,He),Ci.lengthSq()===0&&(Math.abs(i.z)===1?He.x+=1e-4:He.z+=1e-4,He.normalize(),Ci.crossVectors(i,He)),Ci.normalize(),Vs.crossVectors(He,Ci),n[0]=Ci.x,n[4]=Vs.x,n[8]=He.x,n[1]=Ci.y,n[5]=Vs.y,n[9]=He.y,n[2]=Ci.z,n[6]=Vs.z,n[10]=He.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const i=t.elements,n=e.elements,r=this.elements,a=i[0],o=i[4],l=i[8],c=i[12],h=i[1],u=i[5],d=i[9],p=i[13],g=i[2],v=i[6],m=i[10],f=i[14],M=i[3],y=i[7],x=i[11],I=i[15],A=n[0],C=n[4],P=n[8],S=n[12],_=n[1],L=n[5],O=n[9],F=n[13],G=n[2],q=n[6],W=n[10],Z=n[14],V=n[3],ct=n[7],ht=n[11],Mt=n[15];return r[0]=a*A+o*_+l*G+c*V,r[4]=a*C+o*L+l*q+c*ct,r[8]=a*P+o*O+l*W+c*ht,r[12]=a*S+o*F+l*Z+c*Mt,r[1]=h*A+u*_+d*G+p*V,r[5]=h*C+u*L+d*q+p*ct,r[9]=h*P+u*O+d*W+p*ht,r[13]=h*S+u*F+d*Z+p*Mt,r[2]=g*A+v*_+m*G+f*V,r[6]=g*C+v*L+m*q+f*ct,r[10]=g*P+v*O+m*W+f*ht,r[14]=g*S+v*F+m*Z+f*Mt,r[3]=M*A+y*_+x*G+I*V,r[7]=M*C+y*L+x*q+I*ct,r[11]=M*P+y*O+x*W+I*ht,r[15]=M*S+y*F+x*Z+I*Mt,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],i=t[4],n=t[8],r=t[12],a=t[1],o=t[5],l=t[9],c=t[13],h=t[2],u=t[6],d=t[10],p=t[14],g=t[3],v=t[7],m=t[11],f=t[15];return g*(+r*l*u-n*c*u-r*o*d+i*c*d+n*o*p-i*l*p)+v*(+e*l*p-e*c*d+r*a*d-n*a*p+n*c*h-r*l*h)+m*(+e*c*u-e*o*p-r*a*u+i*a*p+r*o*h-i*c*h)+f*(-n*o*h-e*l*u+e*o*d+n*a*u-i*a*d+i*l*h)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,i){const n=this.elements;return t.isVector3?(n[12]=t.x,n[13]=t.y,n[14]=t.z):(n[12]=t,n[13]=e,n[14]=i),this}invert(){const t=this.elements,e=t[0],i=t[1],n=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=t[9],d=t[10],p=t[11],g=t[12],v=t[13],m=t[14],f=t[15],M=u*m*c-v*d*c+v*l*p-o*m*p-u*l*f+o*d*f,y=g*d*c-h*m*c-g*l*p+a*m*p+h*l*f-a*d*f,x=h*v*c-g*u*c+g*o*p-a*v*p-h*o*f+a*u*f,I=g*u*l-h*v*l-g*o*d+a*v*d+h*o*m-a*u*m,A=e*M+i*y+n*x+r*I;if(A===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const C=1/A;return t[0]=M*C,t[1]=(v*d*r-u*m*r-v*n*p+i*m*p+u*n*f-i*d*f)*C,t[2]=(o*m*r-v*l*r+v*n*c-i*m*c-o*n*f+i*l*f)*C,t[3]=(u*l*r-o*d*r-u*n*c+i*d*c+o*n*p-i*l*p)*C,t[4]=y*C,t[5]=(h*m*r-g*d*r+g*n*p-e*m*p-h*n*f+e*d*f)*C,t[6]=(g*l*r-a*m*r-g*n*c+e*m*c+a*n*f-e*l*f)*C,t[7]=(a*d*r-h*l*r+h*n*c-e*d*c-a*n*p+e*l*p)*C,t[8]=x*C,t[9]=(g*u*r-h*v*r-g*i*p+e*v*p+h*i*f-e*u*f)*C,t[10]=(a*v*r-g*o*r+g*i*c-e*v*c-a*i*f+e*o*f)*C,t[11]=(h*o*r-a*u*r-h*i*c+e*u*c+a*i*p-e*o*p)*C,t[12]=I*C,t[13]=(h*v*n-g*u*n+g*i*d-e*v*d-h*i*m+e*u*m)*C,t[14]=(g*o*n-a*v*n-g*i*l+e*v*l+a*i*m-e*o*m)*C,t[15]=(a*u*n-h*o*n+h*i*l-e*u*l-a*i*d+e*o*d)*C,this}scale(t){const e=this.elements,i=t.x,n=t.y,r=t.z;return e[0]*=i,e[4]*=n,e[8]*=r,e[1]*=i,e[5]*=n,e[9]*=r,e[2]*=i,e[6]*=n,e[10]*=r,e[3]*=i,e[7]*=n,e[11]*=r,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],i=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],n=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,i,n))}makeTranslation(t,e,i){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,i,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),i=Math.sin(t);return this.set(1,0,0,0,0,e,-i,0,0,i,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),i=Math.sin(t);return this.set(e,0,i,0,0,1,0,0,-i,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),i=Math.sin(t);return this.set(e,-i,0,0,i,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const i=Math.cos(e),n=Math.sin(e),r=1-i,a=t.x,o=t.y,l=t.z,c=r*a,h=r*o;return this.set(c*a+i,c*o-n*l,c*l+n*o,0,c*o+n*l,h*o+i,h*l-n*a,0,c*l-n*o,h*l+n*a,r*l*l+i,0,0,0,0,1),this}makeScale(t,e,i){return this.set(t,0,0,0,0,e,0,0,0,0,i,0,0,0,0,1),this}makeShear(t,e,i,n,r,a){return this.set(1,i,r,0,t,1,a,0,e,n,1,0,0,0,0,1),this}compose(t,e,i){const n=this.elements,r=e._x,a=e._y,o=e._z,l=e._w,c=r+r,h=a+a,u=o+o,d=r*c,p=r*h,g=r*u,v=a*h,m=a*u,f=o*u,M=l*c,y=l*h,x=l*u,I=i.x,A=i.y,C=i.z;return n[0]=(1-(v+f))*I,n[1]=(p+x)*I,n[2]=(g-y)*I,n[3]=0,n[4]=(p-x)*A,n[5]=(1-(d+f))*A,n[6]=(m+M)*A,n[7]=0,n[8]=(g+y)*C,n[9]=(m-M)*C,n[10]=(1-(d+v))*C,n[11]=0,n[12]=t.x,n[13]=t.y,n[14]=t.z,n[15]=1,this}decompose(t,e,i){const n=this.elements;let r=_n.set(n[0],n[1],n[2]).length();const a=_n.set(n[4],n[5],n[6]).length(),o=_n.set(n[8],n[9],n[10]).length();this.determinant()<0&&(r=-r),t.x=n[12],t.y=n[13],t.z=n[14],ti.copy(this);const c=1/r,h=1/a,u=1/o;return ti.elements[0]*=c,ti.elements[1]*=c,ti.elements[2]*=c,ti.elements[4]*=h,ti.elements[5]*=h,ti.elements[6]*=h,ti.elements[8]*=u,ti.elements[9]*=u,ti.elements[10]*=u,e.setFromRotationMatrix(ti),i.x=r,i.y=a,i.z=o,this}makePerspective(t,e,i,n,r,a,o=_i){const l=this.elements,c=2*r/(e-t),h=2*r/(i-n),u=(e+t)/(e-t),d=(i+n)/(i-n);let p,g;if(o===_i)p=-(a+r)/(a-r),g=-2*a*r/(a-r);else if(o===wr)p=-a/(a-r),g=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=h,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,i,n,r,a,o=_i){const l=this.elements,c=1/(e-t),h=1/(i-n),u=1/(a-r),d=(e+t)*c,p=(i+n)*h;let g,v;if(o===_i)g=(a+r)*u,v=-2*u;else if(o===wr)g=r*u,v=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-p,l[2]=0,l[6]=0,l[10]=v,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){const e=this.elements,i=t.elements;for(let n=0;n<16;n++)if(e[n]!==i[n])return!1;return!0}fromArray(t,e=0){for(let i=0;i<16;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){const i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t[e+9]=i[9],t[e+10]=i[10],t[e+11]=i[11],t[e+12]=i[12],t[e+13]=i[13],t[e+14]=i[14],t[e+15]=i[15],t}}const _n=new R,ti=new se,dd=new R(0,0,0),fd=new R(1,1,1),Ci=new R,Vs=new R,He=new R,vl=new se,xl=new Ds;class ci{constructor(t=0,e=0,i=0,n=ci.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=i,this._order=n}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,i,n=this._order){return this._x=t,this._y=e,this._z=i,this._order=n,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,i=!0){const n=t.elements,r=n[0],a=n[4],o=n[8],l=n[1],c=n[5],h=n[9],u=n[2],d=n[6],p=n[10];switch(e){case"XYZ":this._y=Math.asin(Te(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Te(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(Te(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Te(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,p),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Te(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-Te(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,i===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,i){return vl.makeRotationFromQuaternion(t),this.setFromRotationMatrix(vl,e,i)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return xl.setFromEuler(this),this.setFromQuaternion(xl,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}ci.DEFAULT_ORDER="XYZ";class Qc{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let pd=0;const _l=new R,yn=new Ds,mi=new se,Ws=new R,ns=new R,md=new R,gd=new Ds,yl=new R(1,0,0),Ml=new R(0,1,0),Sl=new R(0,0,1),bl={type:"added"},vd={type:"removed"},Mn={type:"childadded",child:null},ea={type:"childremoved",child:null};class xe extends $n{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:pd++}),this.uuid=hn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=xe.DEFAULT_UP.clone();const t=new R,e=new ci,i=new Ds,n=new R(1,1,1);function r(){i.setFromEuler(e,!1)}function a(){e.setFromQuaternion(i,void 0,!1)}e._onChange(r),i._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:n},modelViewMatrix:{value:new se},normalMatrix:{value:new Vt}}),this.matrix=new se,this.matrixWorld=new se,this.matrixAutoUpdate=xe.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=xe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Qc,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return yn.setFromAxisAngle(t,e),this.quaternion.multiply(yn),this}rotateOnWorldAxis(t,e){return yn.setFromAxisAngle(t,e),this.quaternion.premultiply(yn),this}rotateX(t){return this.rotateOnAxis(yl,t)}rotateY(t){return this.rotateOnAxis(Ml,t)}rotateZ(t){return this.rotateOnAxis(Sl,t)}translateOnAxis(t,e){return _l.copy(t).applyQuaternion(this.quaternion),this.position.add(_l.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(yl,t)}translateY(t){return this.translateOnAxis(Ml,t)}translateZ(t){return this.translateOnAxis(Sl,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(mi.copy(this.matrixWorld).invert())}lookAt(t,e,i){t.isVector3?Ws.copy(t):Ws.set(t,e,i);const n=this.parent;this.updateWorldMatrix(!0,!1),ns.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?mi.lookAt(ns,Ws,this.up):mi.lookAt(Ws,ns,this.up),this.quaternion.setFromRotationMatrix(mi),n&&(mi.extractRotation(n.matrixWorld),yn.setFromRotationMatrix(mi),this.quaternion.premultiply(yn.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(bl),Mn.child=t,this.dispatchEvent(Mn),Mn.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(vd),ea.child=t,this.dispatchEvent(ea),ea.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),mi.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),mi.multiply(t.parent.matrixWorld)),t.applyMatrix4(mi),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(bl),Mn.child=t,this.dispatchEvent(Mn),Mn.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let i=0,n=this.children.length;i<n;i++){const a=this.children[i].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,i=[]){this[t]===e&&i.push(this);const n=this.children;for(let r=0,a=n.length;r<a;r++)n[r].getObjectsByProperty(t,e,i);return i}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ns,t,md),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ns,gd,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let i=0,n=e.length;i<n;i++)e[i].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let i=0,n=e.length;i<n;i++)e[i].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let i=0,n=e.length;i<n;i++)e[i].updateMatrixWorld(t)}updateWorldMatrix(t,e){const i=this.parent;if(t===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){const n=this.children;for(let r=0,a=n.length;r<a;r++)n[r].updateWorldMatrix(!1,!0)}}toJSON(t){const e=t===void 0||typeof t=="string",i={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const n={};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.castShadow===!0&&(n.castShadow=!0),this.receiveShadow===!0&&(n.receiveShadow=!0),this.visible===!1&&(n.visible=!1),this.frustumCulled===!1&&(n.frustumCulled=!1),this.renderOrder!==0&&(n.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(n.userData=this.userData),n.layers=this.layers.mask,n.matrix=this.matrix.toArray(),n.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(n.matrixAutoUpdate=!1),this.isInstancedMesh&&(n.type="InstancedMesh",n.count=this.count,n.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(n.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(n.type="BatchedMesh",n.perObjectFrustumCulled=this.perObjectFrustumCulled,n.sortObjects=this.sortObjects,n.drawRanges=this._drawRanges,n.reservedRanges=this._reservedRanges,n.visibility=this._visibility,n.active=this._active,n.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),n.maxInstanceCount=this._maxInstanceCount,n.maxVertexCount=this._maxVertexCount,n.maxIndexCount=this._maxIndexCount,n.geometryInitialized=this._geometryInitialized,n.geometryCount=this._geometryCount,n.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(n.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(n.boundingSphere={center:n.boundingSphere.center.toArray(),radius:n.boundingSphere.radius}),this.boundingBox!==null&&(n.boundingBox={min:n.boundingBox.min.toArray(),max:n.boundingBox.max.toArray()}));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?n.background=this.background.toJSON():this.background.isTexture&&(n.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(n.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){n.geometry=r(t.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];r(t.shapes,u)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(n.bindMode=this.bindMode,n.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),n.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(t.materials,this.material[l]));n.material=o}else n.material=r(t.materials,this.material);if(this.children.length>0){n.children=[];for(let o=0;o<this.children.length;o++)n.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){n.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];n.animations.push(r(t.animations,l))}}if(e){const o=a(t.geometries),l=a(t.materials),c=a(t.textures),h=a(t.images),u=a(t.shapes),d=a(t.skeletons),p=a(t.animations),g=a(t.nodes);o.length>0&&(i.geometries=o),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),h.length>0&&(i.images=h),u.length>0&&(i.shapes=u),d.length>0&&(i.skeletons=d),p.length>0&&(i.animations=p),g.length>0&&(i.nodes=g)}return i.object=n,i;function a(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let i=0;i<t.children.length;i++){const n=t.children[i];this.add(n.clone())}return this}}xe.DEFAULT_UP=new R(0,1,0);xe.DEFAULT_MATRIX_AUTO_UPDATE=!0;xe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const ei=new R,gi=new R,ia=new R,vi=new R,Sn=new R,bn=new R,wl=new R,na=new R,sa=new R,ra=new R,aa=new ae,oa=new ae,la=new ae;class ni{constructor(t=new R,e=new R,i=new R){this.a=t,this.b=e,this.c=i}static getNormal(t,e,i,n){n.subVectors(i,e),ei.subVectors(t,e),n.cross(ei);const r=n.lengthSq();return r>0?n.multiplyScalar(1/Math.sqrt(r)):n.set(0,0,0)}static getBarycoord(t,e,i,n,r){ei.subVectors(n,e),gi.subVectors(i,e),ia.subVectors(t,e);const a=ei.dot(ei),o=ei.dot(gi),l=ei.dot(ia),c=gi.dot(gi),h=gi.dot(ia),u=a*c-o*o;if(u===0)return r.set(0,0,0),null;const d=1/u,p=(c*l-o*h)*d,g=(a*h-o*l)*d;return r.set(1-p-g,g,p)}static containsPoint(t,e,i,n){return this.getBarycoord(t,e,i,n,vi)===null?!1:vi.x>=0&&vi.y>=0&&vi.x+vi.y<=1}static getInterpolation(t,e,i,n,r,a,o,l){return this.getBarycoord(t,e,i,n,vi)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,vi.x),l.addScaledVector(a,vi.y),l.addScaledVector(o,vi.z),l)}static getInterpolatedAttribute(t,e,i,n,r,a){return aa.setScalar(0),oa.setScalar(0),la.setScalar(0),aa.fromBufferAttribute(t,e),oa.fromBufferAttribute(t,i),la.fromBufferAttribute(t,n),a.setScalar(0),a.addScaledVector(aa,r.x),a.addScaledVector(oa,r.y),a.addScaledVector(la,r.z),a}static isFrontFacing(t,e,i,n){return ei.subVectors(i,e),gi.subVectors(t,e),ei.cross(gi).dot(n)<0}set(t,e,i){return this.a.copy(t),this.b.copy(e),this.c.copy(i),this}setFromPointsAndIndices(t,e,i,n){return this.a.copy(t[e]),this.b.copy(t[i]),this.c.copy(t[n]),this}setFromAttributeAndIndices(t,e,i,n){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,i),this.c.fromBufferAttribute(t,n),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return ei.subVectors(this.c,this.b),gi.subVectors(this.a,this.b),ei.cross(gi).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return ni.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return ni.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,i,n,r){return ni.getInterpolation(t,this.a,this.b,this.c,e,i,n,r)}containsPoint(t){return ni.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return ni.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const i=this.a,n=this.b,r=this.c;let a,o;Sn.subVectors(n,i),bn.subVectors(r,i),na.subVectors(t,i);const l=Sn.dot(na),c=bn.dot(na);if(l<=0&&c<=0)return e.copy(i);sa.subVectors(t,n);const h=Sn.dot(sa),u=bn.dot(sa);if(h>=0&&u<=h)return e.copy(n);const d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return a=l/(l-h),e.copy(i).addScaledVector(Sn,a);ra.subVectors(t,r);const p=Sn.dot(ra),g=bn.dot(ra);if(g>=0&&p<=g)return e.copy(r);const v=p*c-l*g;if(v<=0&&c>=0&&g<=0)return o=c/(c-g),e.copy(i).addScaledVector(bn,o);const m=h*g-p*u;if(m<=0&&u-h>=0&&p-g>=0)return wl.subVectors(r,n),o=(u-h)/(u-h+(p-g)),e.copy(n).addScaledVector(wl,o);const f=1/(m+v+d);return a=v*f,o=d*f,e.copy(i).addScaledVector(Sn,a).addScaledVector(bn,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const th={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Li={h:0,s:0,l:0},Xs={h:0,s:0,l:0};function ca(s,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?s+(t-s)*6*e:e<1/2?t:e<2/3?s+(t-s)*6*(2/3-e):s}class Ut{constructor(t,e,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,i)}set(t,e,i){if(e===void 0&&i===void 0){const n=t;n&&n.isColor?this.copy(n):typeof n=="number"?this.setHex(n):typeof n=="string"&&this.setStyle(n)}else this.setRGB(t,e,i);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=ze){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Jt.toWorkingColorSpace(this,e),this}setRGB(t,e,i,n=Jt.workingColorSpace){return this.r=t,this.g=e,this.b=i,Jt.toWorkingColorSpace(this,n),this}setHSL(t,e,i,n=Jt.workingColorSpace){if(t=Oo(t,1),e=Te(e,0,1),i=Te(i,0,1),e===0)this.r=this.g=this.b=i;else{const r=i<=.5?i*(1+e):i+e-i*e,a=2*i-r;this.r=ca(a,r,t+1/3),this.g=ca(a,r,t),this.b=ca(a,r,t-1/3)}return Jt.toWorkingColorSpace(this,n),this}setStyle(t,e=ze){function i(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let n;if(n=/^(\w+)\(([^\)]*)\)/.exec(t)){let r;const a=n[1],o=n[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return i(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(n=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=n[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=ze){const i=th[t.toLowerCase()];return i!==void 0?this.setHex(i,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=yi(t.r),this.g=yi(t.g),this.b=yi(t.b),this}copyLinearToSRGB(t){return this.r=On(t.r),this.g=On(t.g),this.b=On(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=ze){return Jt.fromWorkingColorSpace(Pe.copy(this),t),Math.round(Te(Pe.r*255,0,255))*65536+Math.round(Te(Pe.g*255,0,255))*256+Math.round(Te(Pe.b*255,0,255))}getHexString(t=ze){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Jt.workingColorSpace){Jt.fromWorkingColorSpace(Pe.copy(this),e);const i=Pe.r,n=Pe.g,r=Pe.b,a=Math.max(i,n,r),o=Math.min(i,n,r);let l,c;const h=(o+a)/2;if(o===a)l=0,c=0;else{const u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case i:l=(n-r)/u+(n<r?6:0);break;case n:l=(r-i)/u+2;break;case r:l=(i-n)/u+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=Jt.workingColorSpace){return Jt.fromWorkingColorSpace(Pe.copy(this),e),t.r=Pe.r,t.g=Pe.g,t.b=Pe.b,t}getStyle(t=ze){Jt.fromWorkingColorSpace(Pe.copy(this),t);const e=Pe.r,i=Pe.g,n=Pe.b;return t!==ze?`color(${t} ${e.toFixed(3)} ${i.toFixed(3)} ${n.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(i*255)},${Math.round(n*255)})`}offsetHSL(t,e,i){return this.getHSL(Li),this.setHSL(Li.h+t,Li.s+e,Li.l+i)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,i){return this.r=t.r+(e.r-t.r)*i,this.g=t.g+(e.g-t.g)*i,this.b=t.b+(e.b-t.b)*i,this}lerpHSL(t,e){this.getHSL(Li),t.getHSL(Xs);const i=ps(Li.h,Xs.h,e),n=ps(Li.s,Xs.s,e),r=ps(Li.l,Xs.l,e);return this.setHSL(i,n,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,i=this.g,n=this.b,r=t.elements;return this.r=r[0]*e+r[3]*i+r[6]*n,this.g=r[1]*e+r[4]*i+r[7]*n,this.b=r[2]*e+r[5]*i+r[8]*n,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Pe=new Ut;Ut.NAMES=th;let xd=0;class Bi extends $n{static get type(){return"Material"}get type(){return this.constructor.type}set type(t){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:xd++}),this.uuid=hn(),this.name="",this.blending=Nn,this.side=Oi,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Pa,this.blendDst=Ia,this.blendEquation=Ji,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ut(0,0,0),this.blendAlpha=0,this.depthFunc=Hn,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=al,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=pn,this.stencilZFail=pn,this.stencilZPass=pn,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const i=t[e];if(i===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const n=this[e];if(n===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}n&&n.isColor?n.set(i):n&&n.isVector3&&i&&i.isVector3?n.copy(i):this[e]=i}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const i={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(t).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(t).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(t).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(t).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(t).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==Nn&&(i.blending=this.blending),this.side!==Oi&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==Pa&&(i.blendSrc=this.blendSrc),this.blendDst!==Ia&&(i.blendDst=this.blendDst),this.blendEquation!==Ji&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==Hn&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==al&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==pn&&(i.stencilFail=this.stencilFail),this.stencilZFail!==pn&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==pn&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function n(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(e){const r=n(t.textures),a=n(t.images);r.length>0&&(i.textures=r),a.length>0&&(i.images=a)}return i}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let i=null;if(e!==null){const n=e.length;i=new Array(n);for(let r=0;r!==n;++r)i[r]=e[r].clone()}return this.clippingPlanes=i,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class he extends Bi{static get type(){return"MeshBasicMaterial"}constructor(t){super(),this.isMeshBasicMaterial=!0,this.color=new Ut(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ci,this.combine=Oc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const Me=new R,qs=new lt;class Ae{constructor(t,e,i=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=i,this.usage=ol,this.updateRanges=[],this.gpuType=li,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,i){t*=this.itemSize,i*=e.itemSize;for(let n=0,r=this.itemSize;n<r;n++)this.array[t+n]=e.array[i+n];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,i=this.count;e<i;e++)qs.fromBufferAttribute(this,e),qs.applyMatrix3(t),this.setXY(e,qs.x,qs.y);else if(this.itemSize===3)for(let e=0,i=this.count;e<i;e++)Me.fromBufferAttribute(this,e),Me.applyMatrix3(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}applyMatrix4(t){for(let e=0,i=this.count;e<i;e++)Me.fromBufferAttribute(this,e),Me.applyMatrix4(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}applyNormalMatrix(t){for(let e=0,i=this.count;e<i;e++)Me.fromBufferAttribute(this,e),Me.applyNormalMatrix(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}transformDirection(t){for(let e=0,i=this.count;e<i;e++)Me.fromBufferAttribute(this,e),Me.transformDirection(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let i=this.array[t*this.itemSize+e];return this.normalized&&(i=Cn(i,this.array)),i}setComponent(t,e,i){return this.normalized&&(i=Ne(i,this.array)),this.array[t*this.itemSize+e]=i,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=Cn(e,this.array)),e}setX(t,e){return this.normalized&&(e=Ne(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=Cn(e,this.array)),e}setY(t,e){return this.normalized&&(e=Ne(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=Cn(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Ne(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=Cn(e,this.array)),e}setW(t,e){return this.normalized&&(e=Ne(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,i){return t*=this.itemSize,this.normalized&&(e=Ne(e,this.array),i=Ne(i,this.array)),this.array[t+0]=e,this.array[t+1]=i,this}setXYZ(t,e,i,n){return t*=this.itemSize,this.normalized&&(e=Ne(e,this.array),i=Ne(i,this.array),n=Ne(n,this.array)),this.array[t+0]=e,this.array[t+1]=i,this.array[t+2]=n,this}setXYZW(t,e,i,n,r){return t*=this.itemSize,this.normalized&&(e=Ne(e,this.array),i=Ne(i,this.array),n=Ne(n,this.array),r=Ne(r,this.array)),this.array[t+0]=e,this.array[t+1]=i,this.array[t+2]=n,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==ol&&(t.usage=this.usage),t}}class eh extends Ae{constructor(t,e,i){super(new Uint16Array(t),e,i)}}class ih extends Ae{constructor(t,e,i){super(new Uint32Array(t),e,i)}}class $t extends Ae{constructor(t,e,i){super(new Float32Array(t),e,i)}}let _d=0;const Ye=new se,ha=new xe,wn=new R,Ge=new un,ss=new un,Ee=new R;class ye extends $n{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:_d++}),this.uuid=hn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(jc(t)?ih:eh)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,i=0){this.groups.push({start:t,count:e,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const i=this.attributes.normal;if(i!==void 0){const r=new Vt().getNormalMatrix(t);i.applyNormalMatrix(r),i.needsUpdate=!0}const n=this.attributes.tangent;return n!==void 0&&(n.transformDirection(t),n.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return Ye.makeRotationFromQuaternion(t),this.applyMatrix4(Ye),this}rotateX(t){return Ye.makeRotationX(t),this.applyMatrix4(Ye),this}rotateY(t){return Ye.makeRotationY(t),this.applyMatrix4(Ye),this}rotateZ(t){return Ye.makeRotationZ(t),this.applyMatrix4(Ye),this}translate(t,e,i){return Ye.makeTranslation(t,e,i),this.applyMatrix4(Ye),this}scale(t,e,i){return Ye.makeScale(t,e,i),this.applyMatrix4(Ye),this}lookAt(t){return ha.lookAt(t),ha.updateMatrix(),this.applyMatrix4(ha.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(wn).negate(),this.translate(wn.x,wn.y,wn.z),this}setFromPoints(t){const e=this.getAttribute("position");if(e===void 0){const i=[];for(let n=0,r=t.length;n<r;n++){const a=t[n];i.push(a.x,a.y,a.z||0)}this.setAttribute("position",new $t(i,3))}else{for(let i=0,n=e.count;i<n;i++){const r=t[i];e.setXYZ(i,r.x,r.y,r.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new un);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new R(-1/0,-1/0,-1/0),new R(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let i=0,n=e.length;i<n;i++){const r=e[i];Ge.setFromBufferAttribute(r),this.morphTargetsRelative?(Ee.addVectors(this.boundingBox.min,Ge.min),this.boundingBox.expandByPoint(Ee),Ee.addVectors(this.boundingBox.max,Ge.max),this.boundingBox.expandByPoint(Ee)):(this.boundingBox.expandByPoint(Ge.min),this.boundingBox.expandByPoint(Ge.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new dn);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new R,1/0);return}if(t){const i=this.boundingSphere.center;if(Ge.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){const o=e[r];ss.setFromBufferAttribute(o),this.morphTargetsRelative?(Ee.addVectors(Ge.min,ss.min),Ge.expandByPoint(Ee),Ee.addVectors(Ge.max,ss.max),Ge.expandByPoint(Ee)):(Ge.expandByPoint(ss.min),Ge.expandByPoint(ss.max))}Ge.getCenter(i);let n=0;for(let r=0,a=t.count;r<a;r++)Ee.fromBufferAttribute(t,r),n=Math.max(n,i.distanceToSquared(Ee));if(e)for(let r=0,a=e.length;r<a;r++){const o=e[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Ee.fromBufferAttribute(o,c),l&&(wn.fromBufferAttribute(t,c),Ee.add(wn)),n=Math.max(n,i.distanceToSquared(Ee))}this.boundingSphere.radius=Math.sqrt(n),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const i=e.position,n=e.normal,r=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Ae(new Float32Array(4*i.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let P=0;P<i.count;P++)o[P]=new R,l[P]=new R;const c=new R,h=new R,u=new R,d=new lt,p=new lt,g=new lt,v=new R,m=new R;function f(P,S,_){c.fromBufferAttribute(i,P),h.fromBufferAttribute(i,S),u.fromBufferAttribute(i,_),d.fromBufferAttribute(r,P),p.fromBufferAttribute(r,S),g.fromBufferAttribute(r,_),h.sub(c),u.sub(c),p.sub(d),g.sub(d);const L=1/(p.x*g.y-g.x*p.y);isFinite(L)&&(v.copy(h).multiplyScalar(g.y).addScaledVector(u,-p.y).multiplyScalar(L),m.copy(u).multiplyScalar(p.x).addScaledVector(h,-g.x).multiplyScalar(L),o[P].add(v),o[S].add(v),o[_].add(v),l[P].add(m),l[S].add(m),l[_].add(m))}let M=this.groups;M.length===0&&(M=[{start:0,count:t.count}]);for(let P=0,S=M.length;P<S;++P){const _=M[P],L=_.start,O=_.count;for(let F=L,G=L+O;F<G;F+=3)f(t.getX(F+0),t.getX(F+1),t.getX(F+2))}const y=new R,x=new R,I=new R,A=new R;function C(P){I.fromBufferAttribute(n,P),A.copy(I);const S=o[P];y.copy(S),y.sub(I.multiplyScalar(I.dot(S))).normalize(),x.crossVectors(A,S);const L=x.dot(l[P])<0?-1:1;a.setXYZW(P,y.x,y.y,y.z,L)}for(let P=0,S=M.length;P<S;++P){const _=M[P],L=_.start,O=_.count;for(let F=L,G=L+O;F<G;F+=3)C(t.getX(F+0)),C(t.getX(F+1)),C(t.getX(F+2))}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let i=this.getAttribute("normal");if(i===void 0)i=new Ae(new Float32Array(e.count*3),3),this.setAttribute("normal",i);else for(let d=0,p=i.count;d<p;d++)i.setXYZ(d,0,0,0);const n=new R,r=new R,a=new R,o=new R,l=new R,c=new R,h=new R,u=new R;if(t)for(let d=0,p=t.count;d<p;d+=3){const g=t.getX(d+0),v=t.getX(d+1),m=t.getX(d+2);n.fromBufferAttribute(e,g),r.fromBufferAttribute(e,v),a.fromBufferAttribute(e,m),h.subVectors(a,r),u.subVectors(n,r),h.cross(u),o.fromBufferAttribute(i,g),l.fromBufferAttribute(i,v),c.fromBufferAttribute(i,m),o.add(h),l.add(h),c.add(h),i.setXYZ(g,o.x,o.y,o.z),i.setXYZ(v,l.x,l.y,l.z),i.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,p=e.count;d<p;d+=3)n.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),a.fromBufferAttribute(e,d+2),h.subVectors(a,r),u.subVectors(n,r),h.cross(u),i.setXYZ(d+0,h.x,h.y,h.z),i.setXYZ(d+1,h.x,h.y,h.z),i.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,i=t.count;e<i;e++)Ee.fromBufferAttribute(t,e),Ee.normalize(),t.setXYZ(e,Ee.x,Ee.y,Ee.z)}toNonIndexed(){function t(o,l){const c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h);let p=0,g=0;for(let v=0,m=l.length;v<m;v++){o.isInterleavedBufferAttribute?p=l[v]*o.data.stride+o.offset:p=l[v]*h;for(let f=0;f<h;f++)d[g++]=c[p++]}return new Ae(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new ye,i=this.index.array,n=this.attributes;for(const o in n){const l=n[o],c=t(l,i);e.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let h=0,u=c.length;h<u;h++){const d=c[h],p=t(d,i);l.push(p)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const i=this.attributes;for(const l in i){const c=i[l];t.data.attributes[l]=c.toJSON(t.data)}const n={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){const p=c[u];h.push(p.toJSON(t.data))}h.length>0&&(n[l]=h,r=!0)}r&&(t.data.morphAttributes=n,t.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(t.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const i=t.index;i!==null&&this.setIndex(i.clone(e));const n=t.attributes;for(const c in n){const h=n[c];this.setAttribute(c,h.clone(e))}const r=t.morphAttributes;for(const c in r){const h=[],u=r[c];for(let d=0,p=u.length;d<p;d++)h.push(u[d].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;const a=t.groups;for(let c=0,h=a.length;c<h;c++){const u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}const o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const El=new se,Wi=new Fo,Ys=new dn,Tl=new R,Ks=new R,$s=new R,js=new R,ua=new R,Zs=new R,Al=new R,Js=new R;class gt extends xe{constructor(t=new ye,e=new he){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,i=Object.keys(e);if(i.length>0){const n=e[i[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=n.length;r<a;r++){const o=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){const i=this.geometry,n=i.attributes.position,r=i.morphAttributes.position,a=i.morphTargetsRelative;e.fromBufferAttribute(n,t);const o=this.morphTargetInfluences;if(r&&o){Zs.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const h=o[l],u=r[l];h!==0&&(ua.fromBufferAttribute(u,t),a?Zs.addScaledVector(ua,h):Zs.addScaledVector(ua.sub(e),h))}e.add(Zs)}return e}raycast(t,e){const i=this.geometry,n=this.material,r=this.matrixWorld;n!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),Ys.copy(i.boundingSphere),Ys.applyMatrix4(r),Wi.copy(t.ray).recast(t.near),!(Ys.containsPoint(Wi.origin)===!1&&(Wi.intersectSphere(Ys,Tl)===null||Wi.origin.distanceToSquared(Tl)>(t.far-t.near)**2))&&(El.copy(r).invert(),Wi.copy(t.ray).applyMatrix4(El),!(i.boundingBox!==null&&Wi.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(t,e,Wi)))}_computeIntersections(t,e,i){let n;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,p=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,v=d.length;g<v;g++){const m=d[g],f=a[m.materialIndex],M=Math.max(m.start,p.start),y=Math.min(o.count,Math.min(m.start+m.count,p.start+p.count));for(let x=M,I=y;x<I;x+=3){const A=o.getX(x),C=o.getX(x+1),P=o.getX(x+2);n=Qs(this,f,t,i,c,h,u,A,C,P),n&&(n.faceIndex=Math.floor(x/3),n.face.materialIndex=m.materialIndex,e.push(n))}}else{const g=Math.max(0,p.start),v=Math.min(o.count,p.start+p.count);for(let m=g,f=v;m<f;m+=3){const M=o.getX(m),y=o.getX(m+1),x=o.getX(m+2);n=Qs(this,a,t,i,c,h,u,M,y,x),n&&(n.faceIndex=Math.floor(m/3),e.push(n))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,v=d.length;g<v;g++){const m=d[g],f=a[m.materialIndex],M=Math.max(m.start,p.start),y=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let x=M,I=y;x<I;x+=3){const A=x,C=x+1,P=x+2;n=Qs(this,f,t,i,c,h,u,A,C,P),n&&(n.faceIndex=Math.floor(x/3),n.face.materialIndex=m.materialIndex,e.push(n))}}else{const g=Math.max(0,p.start),v=Math.min(l.count,p.start+p.count);for(let m=g,f=v;m<f;m+=3){const M=m,y=m+1,x=m+2;n=Qs(this,a,t,i,c,h,u,M,y,x),n&&(n.faceIndex=Math.floor(m/3),e.push(n))}}}}function yd(s,t,e,i,n,r,a,o){let l;if(t.side===De?l=i.intersectTriangle(a,r,n,!0,o):l=i.intersectTriangle(n,r,a,t.side===Oi,o),l===null)return null;Js.copy(o),Js.applyMatrix4(s.matrixWorld);const c=e.ray.origin.distanceTo(Js);return c<e.near||c>e.far?null:{distance:c,point:Js.clone(),object:s}}function Qs(s,t,e,i,n,r,a,o,l,c){s.getVertexPosition(o,Ks),s.getVertexPosition(l,$s),s.getVertexPosition(c,js);const h=yd(s,t,e,i,Ks,$s,js,Al);if(h){const u=new R;ni.getBarycoord(Al,Ks,$s,js,u),n&&(h.uv=ni.getInterpolatedAttribute(n,o,l,c,u,new lt)),r&&(h.uv1=ni.getInterpolatedAttribute(r,o,l,c,u,new lt)),a&&(h.normal=ni.getInterpolatedAttribute(a,o,l,c,u,new R),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));const d={a:o,b:l,c,normal:new R,materialIndex:0};ni.getNormal(Ks,$s,js,d.normal),h.face=d,h.barycoord=u}return h}class Fi extends ye{constructor(t=1,e=1,i=1,n=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:i,widthSegments:n,heightSegments:r,depthSegments:a};const o=this;n=Math.floor(n),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],h=[],u=[];let d=0,p=0;g("z","y","x",-1,-1,i,e,t,a,r,0),g("z","y","x",1,-1,i,e,-t,a,r,1),g("x","z","y",1,1,t,i,e,n,a,2),g("x","z","y",1,-1,t,i,-e,n,a,3),g("x","y","z",1,-1,t,e,i,n,r,4),g("x","y","z",-1,-1,t,e,-i,n,r,5),this.setIndex(l),this.setAttribute("position",new $t(c,3)),this.setAttribute("normal",new $t(h,3)),this.setAttribute("uv",new $t(u,2));function g(v,m,f,M,y,x,I,A,C,P,S){const _=x/C,L=I/P,O=x/2,F=I/2,G=A/2,q=C+1,W=P+1;let Z=0,V=0;const ct=new R;for(let ht=0;ht<W;ht++){const Mt=ht*L-F;for(let zt=0;zt<q;zt++){const jt=zt*_-O;ct[v]=jt*M,ct[m]=Mt*y,ct[f]=G,c.push(ct.x,ct.y,ct.z),ct[v]=0,ct[m]=0,ct[f]=A>0?1:-1,h.push(ct.x,ct.y,ct.z),u.push(zt/C),u.push(1-ht/P),Z+=1}}for(let ht=0;ht<P;ht++)for(let Mt=0;Mt<C;Mt++){const zt=d+Mt+q*ht,jt=d+Mt+q*(ht+1),Y=d+(Mt+1)+q*(ht+1),nt=d+(Mt+1)+q*ht;l.push(zt,jt,nt),l.push(jt,Y,nt),V+=6}o.addGroup(p,V,S),p+=V,d+=Z}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Fi(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function qn(s){const t={};for(const e in s){t[e]={};for(const i in s[e]){const n=s[e][i];n&&(n.isColor||n.isMatrix3||n.isMatrix4||n.isVector2||n.isVector3||n.isVector4||n.isTexture||n.isQuaternion)?n.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][i]=null):t[e][i]=n.clone():Array.isArray(n)?t[e][i]=n.slice():t[e][i]=n}}return t}function ke(s){const t={};for(let e=0;e<s.length;e++){const i=qn(s[e]);for(const n in i)t[n]=i[n]}return t}function Md(s){const t=[];for(let e=0;e<s.length;e++)t.push(s[e].clone());return t}function nh(s){const t=s.getRenderTarget();return t===null?s.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Jt.workingColorSpace}const Sd={clone:qn,merge:ke};var bd=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,wd=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Si extends Bi{static get type(){return"ShaderMaterial"}constructor(t){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=bd,this.fragmentShader=wd,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=qn(t.uniforms),this.uniformsGroups=Md(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const n in this.uniforms){const a=this.uniforms[n].value;a&&a.isTexture?e.uniforms[n]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[n]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[n]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[n]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[n]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[n]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[n]={type:"m4",value:a.toArray()}:e.uniforms[n]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const i={};for(const n in this.extensions)this.extensions[n]===!0&&(i[n]=!0);return Object.keys(i).length>0&&(e.extensions=i),e}}class sh extends xe{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new se,this.projectionMatrix=new se,this.projectionMatrixInverse=new se,this.coordinateSystem=_i}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const Pi=new R,Rl=new lt,Cl=new lt;class We extends sh{constructor(t=50,e=1,i=.1,n=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=i,this.far=n,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=bs*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(fs*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return bs*2*Math.atan(Math.tan(fs*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,i){Pi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(Pi.x,Pi.y).multiplyScalar(-t/Pi.z),Pi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(Pi.x,Pi.y).multiplyScalar(-t/Pi.z)}getViewSize(t,e){return this.getViewBounds(t,Rl,Cl),e.subVectors(Cl,Rl)}setViewOffset(t,e,i,n,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=i,this.view.offsetY=n,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(fs*.5*this.fov)/this.zoom,i=2*e,n=this.aspect*i,r=-.5*n;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*n/l,e-=a.offsetY*i/c,n*=a.width/l,i*=a.height/c}const o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+n,e,e-i,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const En=-90,Tn=1;class Ed extends xe{constructor(t,e,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;const n=new We(En,Tn,t,e);n.layers=this.layers,this.add(n);const r=new We(En,Tn,t,e);r.layers=this.layers,this.add(r);const a=new We(En,Tn,t,e);a.layers=this.layers,this.add(a);const o=new We(En,Tn,t,e);o.layers=this.layers,this.add(o);const l=new We(En,Tn,t,e);l.layers=this.layers,this.add(l);const c=new We(En,Tn,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[i,n,r,a,o,l]=e;for(const c of e)this.remove(c);if(t===_i)i.up.set(0,1,0),i.lookAt(1,0,0),n.up.set(0,1,0),n.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===wr)i.up.set(0,-1,0),i.lookAt(-1,0,0),n.up.set(0,-1,0),n.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:i,activeMipmapLevel:n}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,h]=this.children,u=t.getRenderTarget(),d=t.getActiveCubeFace(),p=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;const v=i.texture.generateMipmaps;i.texture.generateMipmaps=!1,t.setRenderTarget(i,0,n),t.render(e,r),t.setRenderTarget(i,1,n),t.render(e,a),t.setRenderTarget(i,2,n),t.render(e,o),t.setRenderTarget(i,3,n),t.render(e,l),t.setRenderTarget(i,4,n),t.render(e,c),i.texture.generateMipmaps=v,t.setRenderTarget(i,5,n),t.render(e,h),t.setRenderTarget(u,d,p),t.xr.enabled=g,i.texture.needsPMREMUpdate=!0}}class rh extends Ue{constructor(t,e,i,n,r,a,o,l,c,h){t=t!==void 0?t:[],e=e!==void 0?e:Gn,super(t,e,i,n,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class Td extends rn{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const i={width:t,height:t,depth:1},n=[i,i,i,i,i,i];this.texture=new rh(n,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:oi}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},n=new Fi(5,5,5),r=new Si({name:"CubemapFromEquirect",uniforms:qn(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:De,blending:Ni});r.uniforms.tEquirect.value=e;const a=new gt(n,r),o=e.minFilter;return e.minFilter===en&&(e.minFilter=oi),new Ed(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e,i,n){const r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,i,n);t.setRenderTarget(r)}}const da=new R,Ad=new R,Rd=new Vt;class ji{constructor(t=new R(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,i,n){return this.normal.set(t,e,i),this.constant=n,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,i){const n=da.subVectors(i,e).cross(Ad.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(n,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const i=t.delta(da),n=this.normal.dot(i);if(n===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const r=-(t.start.dot(this.normal)+this.constant)/n;return r<0||r>1?null:e.copy(t.start).addScaledVector(i,r)}intersectsLine(t){const e=this.distanceToPoint(t.start),i=this.distanceToPoint(t.end);return e<0&&i>0||i<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const i=e||Rd.getNormalMatrix(t),n=this.coplanarPoint(da).applyMatrix4(t),r=this.normal.applyMatrix3(i).normalize();return this.constant=-n.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Xi=new dn,tr=new R;class zo{constructor(t=new ji,e=new ji,i=new ji,n=new ji,r=new ji,a=new ji){this.planes=[t,e,i,n,r,a]}set(t,e,i,n,r,a){const o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(i),o[3].copy(n),o[4].copy(r),o[5].copy(a),this}copy(t){const e=this.planes;for(let i=0;i<6;i++)e[i].copy(t.planes[i]);return this}setFromProjectionMatrix(t,e=_i){const i=this.planes,n=t.elements,r=n[0],a=n[1],o=n[2],l=n[3],c=n[4],h=n[5],u=n[6],d=n[7],p=n[8],g=n[9],v=n[10],m=n[11],f=n[12],M=n[13],y=n[14],x=n[15];if(i[0].setComponents(l-r,d-c,m-p,x-f).normalize(),i[1].setComponents(l+r,d+c,m+p,x+f).normalize(),i[2].setComponents(l+a,d+h,m+g,x+M).normalize(),i[3].setComponents(l-a,d-h,m-g,x-M).normalize(),i[4].setComponents(l-o,d-u,m-v,x-y).normalize(),e===_i)i[5].setComponents(l+o,d+u,m+v,x+y).normalize();else if(e===wr)i[5].setComponents(o,u,v,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Xi.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Xi.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Xi)}intersectsSprite(t){return Xi.center.set(0,0,0),Xi.radius=.7071067811865476,Xi.applyMatrix4(t.matrixWorld),this.intersectsSphere(Xi)}intersectsSphere(t){const e=this.planes,i=t.center,n=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(i)<n)return!1;return!0}intersectsBox(t){const e=this.planes;for(let i=0;i<6;i++){const n=e[i];if(tr.x=n.normal.x>0?t.max.x:t.min.x,tr.y=n.normal.y>0?t.max.y:t.min.y,tr.z=n.normal.z>0?t.max.z:t.min.z,n.distanceToPoint(tr)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let i=0;i<6;i++)if(e[i].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function ah(){let s=null,t=!1,e=null,i=null;function n(r,a){e(r,a),i=s.requestAnimationFrame(n)}return{start:function(){t!==!0&&e!==null&&(i=s.requestAnimationFrame(n),t=!0)},stop:function(){s.cancelAnimationFrame(i),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){s=r}}}function Cd(s){const t=new WeakMap;function e(o,l){const c=o.array,h=o.usage,u=c.byteLength,d=s.createBuffer();s.bindBuffer(l,d),s.bufferData(l,c,h),o.onUploadCallback();let p;if(c instanceof Float32Array)p=s.FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?p=s.HALF_FLOAT:p=s.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=s.SHORT;else if(c instanceof Uint32Array)p=s.UNSIGNED_INT;else if(c instanceof Int32Array)p=s.INT;else if(c instanceof Int8Array)p=s.BYTE;else if(c instanceof Uint8Array)p=s.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function i(o,l,c){const h=l.array,u=l.updateRanges;if(s.bindBuffer(c,o),u.length===0)s.bufferSubData(c,0,h);else{u.sort((p,g)=>p.start-g.start);let d=0;for(let p=1;p<u.length;p++){const g=u[d],v=u[p];v.start<=g.start+g.count+1?g.count=Math.max(g.count,v.start+v.count-g.start):(++d,u[d]=v)}u.length=d+1;for(let p=0,g=u.length;p<g;p++){const v=u[p];s.bufferSubData(c,v.start*h.BYTES_PER_ELEMENT,h,v.start,v.count)}l.clearUpdateRanges()}l.onUploadCallback()}function n(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=t.get(o);l&&(s.deleteBuffer(l.buffer),t.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=t.get(o);if(c===void 0)t.set(o,e(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,o,l),c.version=o.version}}return{get:n,remove:r,update:a}}class Dr extends ye{constructor(t=1,e=1,i=1,n=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:i,heightSegments:n};const r=t/2,a=e/2,o=Math.floor(i),l=Math.floor(n),c=o+1,h=l+1,u=t/o,d=e/l,p=[],g=[],v=[],m=[];for(let f=0;f<h;f++){const M=f*d-a;for(let y=0;y<c;y++){const x=y*u-r;g.push(x,-M,0),v.push(0,0,1),m.push(y/o),m.push(1-f/l)}}for(let f=0;f<l;f++)for(let M=0;M<o;M++){const y=M+c*f,x=M+c*(f+1),I=M+1+c*(f+1),A=M+1+c*f;p.push(y,x,A),p.push(x,I,A)}this.setIndex(p),this.setAttribute("position",new $t(g,3)),this.setAttribute("normal",new $t(v,3)),this.setAttribute("uv",new $t(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Dr(t.width,t.height,t.widthSegments,t.heightSegments)}}var Ld=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Pd=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Id=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Dd=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Ud=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Nd=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,kd=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Od=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Fd=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,zd=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Bd=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Hd=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Gd=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Vd=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Wd=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Xd=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,qd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Yd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Kd=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,$d=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,jd=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Zd=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,Jd=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,Qd=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,tf=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,ef=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,nf=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,sf=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,rf=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,af=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,of="gl_FragColor = linearToOutputTexel( gl_FragColor );",lf=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,cf=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,hf=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,uf=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,df=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,ff=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,pf=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,mf=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,gf=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,vf=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,xf=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,_f=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,yf=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Mf=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Sf=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,bf=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,wf=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Ef=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Tf=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Af=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Rf=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Cf=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Lf=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Pf=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,If=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Df=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Uf=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Nf=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,kf=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Of=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Ff=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,zf=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Bf=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Hf=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Gf=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Vf=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Wf=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Xf=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,qf=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Yf=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Kf=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,$f=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,jf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Zf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Jf=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Qf=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,tp=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,ep=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,ip=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,np=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,sp=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,rp=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,ap=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,op=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,lp=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,cp=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,hp=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,up=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,dp=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,fp=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,pp=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,mp=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,gp=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,vp=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,xp=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,_p=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,yp=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Mp=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Sp=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,bp=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,wp=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Ep=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Tp=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Ap=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Rp=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Cp=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Lp=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Pp=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Ip=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Dp=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Up=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Np=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,kp=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Op=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Fp=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,zp=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,Bp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Hp=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Gp=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Vp=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Wp=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Xp=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,qp=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Yp=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Kp=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,$p=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,jp=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Zp=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Jp=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Qp=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,tm=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,em=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,im=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,nm=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,sm=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,rm=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,am=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,om=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,lm=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,cm=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Xt={alphahash_fragment:Ld,alphahash_pars_fragment:Pd,alphamap_fragment:Id,alphamap_pars_fragment:Dd,alphatest_fragment:Ud,alphatest_pars_fragment:Nd,aomap_fragment:kd,aomap_pars_fragment:Od,batching_pars_vertex:Fd,batching_vertex:zd,begin_vertex:Bd,beginnormal_vertex:Hd,bsdfs:Gd,iridescence_fragment:Vd,bumpmap_pars_fragment:Wd,clipping_planes_fragment:Xd,clipping_planes_pars_fragment:qd,clipping_planes_pars_vertex:Yd,clipping_planes_vertex:Kd,color_fragment:$d,color_pars_fragment:jd,color_pars_vertex:Zd,color_vertex:Jd,common:Qd,cube_uv_reflection_fragment:tf,defaultnormal_vertex:ef,displacementmap_pars_vertex:nf,displacementmap_vertex:sf,emissivemap_fragment:rf,emissivemap_pars_fragment:af,colorspace_fragment:of,colorspace_pars_fragment:lf,envmap_fragment:cf,envmap_common_pars_fragment:hf,envmap_pars_fragment:uf,envmap_pars_vertex:df,envmap_physical_pars_fragment:bf,envmap_vertex:ff,fog_vertex:pf,fog_pars_vertex:mf,fog_fragment:gf,fog_pars_fragment:vf,gradientmap_pars_fragment:xf,lightmap_pars_fragment:_f,lights_lambert_fragment:yf,lights_lambert_pars_fragment:Mf,lights_pars_begin:Sf,lights_toon_fragment:wf,lights_toon_pars_fragment:Ef,lights_phong_fragment:Tf,lights_phong_pars_fragment:Af,lights_physical_fragment:Rf,lights_physical_pars_fragment:Cf,lights_fragment_begin:Lf,lights_fragment_maps:Pf,lights_fragment_end:If,logdepthbuf_fragment:Df,logdepthbuf_pars_fragment:Uf,logdepthbuf_pars_vertex:Nf,logdepthbuf_vertex:kf,map_fragment:Of,map_pars_fragment:Ff,map_particle_fragment:zf,map_particle_pars_fragment:Bf,metalnessmap_fragment:Hf,metalnessmap_pars_fragment:Gf,morphinstance_vertex:Vf,morphcolor_vertex:Wf,morphnormal_vertex:Xf,morphtarget_pars_vertex:qf,morphtarget_vertex:Yf,normal_fragment_begin:Kf,normal_fragment_maps:$f,normal_pars_fragment:jf,normal_pars_vertex:Zf,normal_vertex:Jf,normalmap_pars_fragment:Qf,clearcoat_normal_fragment_begin:tp,clearcoat_normal_fragment_maps:ep,clearcoat_pars_fragment:ip,iridescence_pars_fragment:np,opaque_fragment:sp,packing:rp,premultiplied_alpha_fragment:ap,project_vertex:op,dithering_fragment:lp,dithering_pars_fragment:cp,roughnessmap_fragment:hp,roughnessmap_pars_fragment:up,shadowmap_pars_fragment:dp,shadowmap_pars_vertex:fp,shadowmap_vertex:pp,shadowmask_pars_fragment:mp,skinbase_vertex:gp,skinning_pars_vertex:vp,skinning_vertex:xp,skinnormal_vertex:_p,specularmap_fragment:yp,specularmap_pars_fragment:Mp,tonemapping_fragment:Sp,tonemapping_pars_fragment:bp,transmission_fragment:wp,transmission_pars_fragment:Ep,uv_pars_fragment:Tp,uv_pars_vertex:Ap,uv_vertex:Rp,worldpos_vertex:Cp,background_vert:Lp,background_frag:Pp,backgroundCube_vert:Ip,backgroundCube_frag:Dp,cube_vert:Up,cube_frag:Np,depth_vert:kp,depth_frag:Op,distanceRGBA_vert:Fp,distanceRGBA_frag:zp,equirect_vert:Bp,equirect_frag:Hp,linedashed_vert:Gp,linedashed_frag:Vp,meshbasic_vert:Wp,meshbasic_frag:Xp,meshlambert_vert:qp,meshlambert_frag:Yp,meshmatcap_vert:Kp,meshmatcap_frag:$p,meshnormal_vert:jp,meshnormal_frag:Zp,meshphong_vert:Jp,meshphong_frag:Qp,meshphysical_vert:tm,meshphysical_frag:em,meshtoon_vert:im,meshtoon_frag:nm,points_vert:sm,points_frag:rm,shadow_vert:am,shadow_frag:om,sprite_vert:lm,sprite_frag:cm},dt={common:{diffuse:{value:new Ut(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Vt},alphaMap:{value:null},alphaMapTransform:{value:new Vt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Vt}},envmap:{envMap:{value:null},envMapRotation:{value:new Vt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Vt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Vt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Vt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Vt},normalScale:{value:new lt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Vt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Vt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Vt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Vt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ut(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Ut(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Vt},alphaTest:{value:0},uvTransform:{value:new Vt}},sprite:{diffuse:{value:new Ut(16777215)},opacity:{value:1},center:{value:new lt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Vt},alphaMap:{value:null},alphaMapTransform:{value:new Vt},alphaTest:{value:0}}},ai={basic:{uniforms:ke([dt.common,dt.specularmap,dt.envmap,dt.aomap,dt.lightmap,dt.fog]),vertexShader:Xt.meshbasic_vert,fragmentShader:Xt.meshbasic_frag},lambert:{uniforms:ke([dt.common,dt.specularmap,dt.envmap,dt.aomap,dt.lightmap,dt.emissivemap,dt.bumpmap,dt.normalmap,dt.displacementmap,dt.fog,dt.lights,{emissive:{value:new Ut(0)}}]),vertexShader:Xt.meshlambert_vert,fragmentShader:Xt.meshlambert_frag},phong:{uniforms:ke([dt.common,dt.specularmap,dt.envmap,dt.aomap,dt.lightmap,dt.emissivemap,dt.bumpmap,dt.normalmap,dt.displacementmap,dt.fog,dt.lights,{emissive:{value:new Ut(0)},specular:{value:new Ut(1118481)},shininess:{value:30}}]),vertexShader:Xt.meshphong_vert,fragmentShader:Xt.meshphong_frag},standard:{uniforms:ke([dt.common,dt.envmap,dt.aomap,dt.lightmap,dt.emissivemap,dt.bumpmap,dt.normalmap,dt.displacementmap,dt.roughnessmap,dt.metalnessmap,dt.fog,dt.lights,{emissive:{value:new Ut(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Xt.meshphysical_vert,fragmentShader:Xt.meshphysical_frag},toon:{uniforms:ke([dt.common,dt.aomap,dt.lightmap,dt.emissivemap,dt.bumpmap,dt.normalmap,dt.displacementmap,dt.gradientmap,dt.fog,dt.lights,{emissive:{value:new Ut(0)}}]),vertexShader:Xt.meshtoon_vert,fragmentShader:Xt.meshtoon_frag},matcap:{uniforms:ke([dt.common,dt.bumpmap,dt.normalmap,dt.displacementmap,dt.fog,{matcap:{value:null}}]),vertexShader:Xt.meshmatcap_vert,fragmentShader:Xt.meshmatcap_frag},points:{uniforms:ke([dt.points,dt.fog]),vertexShader:Xt.points_vert,fragmentShader:Xt.points_frag},dashed:{uniforms:ke([dt.common,dt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Xt.linedashed_vert,fragmentShader:Xt.linedashed_frag},depth:{uniforms:ke([dt.common,dt.displacementmap]),vertexShader:Xt.depth_vert,fragmentShader:Xt.depth_frag},normal:{uniforms:ke([dt.common,dt.bumpmap,dt.normalmap,dt.displacementmap,{opacity:{value:1}}]),vertexShader:Xt.meshnormal_vert,fragmentShader:Xt.meshnormal_frag},sprite:{uniforms:ke([dt.sprite,dt.fog]),vertexShader:Xt.sprite_vert,fragmentShader:Xt.sprite_frag},background:{uniforms:{uvTransform:{value:new Vt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Xt.background_vert,fragmentShader:Xt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Vt}},vertexShader:Xt.backgroundCube_vert,fragmentShader:Xt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Xt.cube_vert,fragmentShader:Xt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Xt.equirect_vert,fragmentShader:Xt.equirect_frag},distanceRGBA:{uniforms:ke([dt.common,dt.displacementmap,{referencePosition:{value:new R},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Xt.distanceRGBA_vert,fragmentShader:Xt.distanceRGBA_frag},shadow:{uniforms:ke([dt.lights,dt.fog,{color:{value:new Ut(0)},opacity:{value:1}}]),vertexShader:Xt.shadow_vert,fragmentShader:Xt.shadow_frag}};ai.physical={uniforms:ke([ai.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Vt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Vt},clearcoatNormalScale:{value:new lt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Vt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Vt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Vt},sheen:{value:0},sheenColor:{value:new Ut(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Vt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Vt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Vt},transmissionSamplerSize:{value:new lt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Vt},attenuationDistance:{value:0},attenuationColor:{value:new Ut(0)},specularColor:{value:new Ut(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Vt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Vt},anisotropyVector:{value:new lt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Vt}}]),vertexShader:Xt.meshphysical_vert,fragmentShader:Xt.meshphysical_frag};const er={r:0,b:0,g:0},qi=new ci,hm=new se;function um(s,t,e,i,n,r,a){const o=new Ut(0);let l=r===!0?0:1,c,h,u=null,d=0,p=null;function g(M){let y=M.isScene===!0?M.background:null;return y&&y.isTexture&&(y=(M.backgroundBlurriness>0?e:t).get(y)),y}function v(M){let y=!1;const x=g(M);x===null?f(o,l):x&&x.isColor&&(f(x,1),y=!0);const I=s.xr.getEnvironmentBlendMode();I==="additive"?i.buffers.color.setClear(0,0,0,1,a):I==="alpha-blend"&&i.buffers.color.setClear(0,0,0,0,a),(s.autoClear||y)&&(i.buffers.depth.setTest(!0),i.buffers.depth.setMask(!0),i.buffers.color.setMask(!0),s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil))}function m(M,y){const x=g(y);x&&(x.isCubeTexture||x.mapping===Pr)?(h===void 0&&(h=new gt(new Fi(1,1,1),new Si({name:"BackgroundCubeMaterial",uniforms:qn(ai.backgroundCube.uniforms),vertexShader:ai.backgroundCube.vertexShader,fragmentShader:ai.backgroundCube.fragmentShader,side:De,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(I,A,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(h)),qi.copy(y.backgroundRotation),qi.x*=-1,qi.y*=-1,qi.z*=-1,x.isCubeTexture&&x.isRenderTargetTexture===!1&&(qi.y*=-1,qi.z*=-1),h.material.uniforms.envMap.value=x,h.material.uniforms.flipEnvMap.value=x.isCubeTexture&&x.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=y.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(hm.makeRotationFromEuler(qi)),h.material.toneMapped=Jt.getTransfer(x.colorSpace)!==re,(u!==x||d!==x.version||p!==s.toneMapping)&&(h.material.needsUpdate=!0,u=x,d=x.version,p=s.toneMapping),h.layers.enableAll(),M.unshift(h,h.geometry,h.material,0,0,null)):x&&x.isTexture&&(c===void 0&&(c=new gt(new Dr(2,2),new Si({name:"BackgroundMaterial",uniforms:qn(ai.background.uniforms),vertexShader:ai.background.vertexShader,fragmentShader:ai.background.fragmentShader,side:Oi,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(c)),c.material.uniforms.t2D.value=x,c.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,c.material.toneMapped=Jt.getTransfer(x.colorSpace)!==re,x.matrixAutoUpdate===!0&&x.updateMatrix(),c.material.uniforms.uvTransform.value.copy(x.matrix),(u!==x||d!==x.version||p!==s.toneMapping)&&(c.material.needsUpdate=!0,u=x,d=x.version,p=s.toneMapping),c.layers.enableAll(),M.unshift(c,c.geometry,c.material,0,0,null))}function f(M,y){M.getRGB(er,nh(s)),i.buffers.color.setClear(er.r,er.g,er.b,y,a)}return{getClearColor:function(){return o},setClearColor:function(M,y=1){o.set(M),l=y,f(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(M){l=M,f(o,l)},render:v,addToRenderList:m}}function dm(s,t){const e=s.getParameter(s.MAX_VERTEX_ATTRIBS),i={},n=d(null);let r=n,a=!1;function o(_,L,O,F,G){let q=!1;const W=u(F,O,L);r!==W&&(r=W,c(r.object)),q=p(_,F,O,G),q&&g(_,F,O,G),G!==null&&t.update(G,s.ELEMENT_ARRAY_BUFFER),(q||a)&&(a=!1,x(_,L,O,F),G!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,t.get(G).buffer))}function l(){return s.createVertexArray()}function c(_){return s.bindVertexArray(_)}function h(_){return s.deleteVertexArray(_)}function u(_,L,O){const F=O.wireframe===!0;let G=i[_.id];G===void 0&&(G={},i[_.id]=G);let q=G[L.id];q===void 0&&(q={},G[L.id]=q);let W=q[F];return W===void 0&&(W=d(l()),q[F]=W),W}function d(_){const L=[],O=[],F=[];for(let G=0;G<e;G++)L[G]=0,O[G]=0,F[G]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:L,enabledAttributes:O,attributeDivisors:F,object:_,attributes:{},index:null}}function p(_,L,O,F){const G=r.attributes,q=L.attributes;let W=0;const Z=O.getAttributes();for(const V in Z)if(Z[V].location>=0){const ht=G[V];let Mt=q[V];if(Mt===void 0&&(V==="instanceMatrix"&&_.instanceMatrix&&(Mt=_.instanceMatrix),V==="instanceColor"&&_.instanceColor&&(Mt=_.instanceColor)),ht===void 0||ht.attribute!==Mt||Mt&&ht.data!==Mt.data)return!0;W++}return r.attributesNum!==W||r.index!==F}function g(_,L,O,F){const G={},q=L.attributes;let W=0;const Z=O.getAttributes();for(const V in Z)if(Z[V].location>=0){let ht=q[V];ht===void 0&&(V==="instanceMatrix"&&_.instanceMatrix&&(ht=_.instanceMatrix),V==="instanceColor"&&_.instanceColor&&(ht=_.instanceColor));const Mt={};Mt.attribute=ht,ht&&ht.data&&(Mt.data=ht.data),G[V]=Mt,W++}r.attributes=G,r.attributesNum=W,r.index=F}function v(){const _=r.newAttributes;for(let L=0,O=_.length;L<O;L++)_[L]=0}function m(_){f(_,0)}function f(_,L){const O=r.newAttributes,F=r.enabledAttributes,G=r.attributeDivisors;O[_]=1,F[_]===0&&(s.enableVertexAttribArray(_),F[_]=1),G[_]!==L&&(s.vertexAttribDivisor(_,L),G[_]=L)}function M(){const _=r.newAttributes,L=r.enabledAttributes;for(let O=0,F=L.length;O<F;O++)L[O]!==_[O]&&(s.disableVertexAttribArray(O),L[O]=0)}function y(_,L,O,F,G,q,W){W===!0?s.vertexAttribIPointer(_,L,O,G,q):s.vertexAttribPointer(_,L,O,F,G,q)}function x(_,L,O,F){v();const G=F.attributes,q=O.getAttributes(),W=L.defaultAttributeValues;for(const Z in q){const V=q[Z];if(V.location>=0){let ct=G[Z];if(ct===void 0&&(Z==="instanceMatrix"&&_.instanceMatrix&&(ct=_.instanceMatrix),Z==="instanceColor"&&_.instanceColor&&(ct=_.instanceColor)),ct!==void 0){const ht=ct.normalized,Mt=ct.itemSize,zt=t.get(ct);if(zt===void 0)continue;const jt=zt.buffer,Y=zt.type,nt=zt.bytesPerElement,St=Y===s.INT||Y===s.UNSIGNED_INT||ct.gpuType===Co;if(ct.isInterleavedBufferAttribute){const at=ct.data,Lt=at.stride,kt=ct.offset;if(at.isInstancedInterleavedBuffer){for(let Nt=0;Nt<V.locationSize;Nt++)f(V.location+Nt,at.meshPerAttribute);_.isInstancedMesh!==!0&&F._maxInstanceCount===void 0&&(F._maxInstanceCount=at.meshPerAttribute*at.count)}else for(let Nt=0;Nt<V.locationSize;Nt++)m(V.location+Nt);s.bindBuffer(s.ARRAY_BUFFER,jt);for(let Nt=0;Nt<V.locationSize;Nt++)y(V.location+Nt,Mt/V.locationSize,Y,ht,Lt*nt,(kt+Mt/V.locationSize*Nt)*nt,St)}else{if(ct.isInstancedBufferAttribute){for(let at=0;at<V.locationSize;at++)f(V.location+at,ct.meshPerAttribute);_.isInstancedMesh!==!0&&F._maxInstanceCount===void 0&&(F._maxInstanceCount=ct.meshPerAttribute*ct.count)}else for(let at=0;at<V.locationSize;at++)m(V.location+at);s.bindBuffer(s.ARRAY_BUFFER,jt);for(let at=0;at<V.locationSize;at++)y(V.location+at,Mt/V.locationSize,Y,ht,Mt*nt,Mt/V.locationSize*at*nt,St)}}else if(W!==void 0){const ht=W[Z];if(ht!==void 0)switch(ht.length){case 2:s.vertexAttrib2fv(V.location,ht);break;case 3:s.vertexAttrib3fv(V.location,ht);break;case 4:s.vertexAttrib4fv(V.location,ht);break;default:s.vertexAttrib1fv(V.location,ht)}}}}M()}function I(){P();for(const _ in i){const L=i[_];for(const O in L){const F=L[O];for(const G in F)h(F[G].object),delete F[G];delete L[O]}delete i[_]}}function A(_){if(i[_.id]===void 0)return;const L=i[_.id];for(const O in L){const F=L[O];for(const G in F)h(F[G].object),delete F[G];delete L[O]}delete i[_.id]}function C(_){for(const L in i){const O=i[L];if(O[_.id]===void 0)continue;const F=O[_.id];for(const G in F)h(F[G].object),delete F[G];delete O[_.id]}}function P(){S(),a=!0,r!==n&&(r=n,c(r.object))}function S(){n.geometry=null,n.program=null,n.wireframe=!1}return{setup:o,reset:P,resetDefaultState:S,dispose:I,releaseStatesOfGeometry:A,releaseStatesOfProgram:C,initAttributes:v,enableAttribute:m,disableUnusedAttributes:M}}function fm(s,t,e){let i;function n(c){i=c}function r(c,h){s.drawArrays(i,c,h),e.update(h,i,1)}function a(c,h,u){u!==0&&(s.drawArraysInstanced(i,c,h,u),e.update(h,i,u))}function o(c,h,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,c,0,h,0,u);let p=0;for(let g=0;g<u;g++)p+=h[g];e.update(p,i,1)}function l(c,h,u,d){if(u===0)return;const p=t.get("WEBGL_multi_draw");if(p===null)for(let g=0;g<c.length;g++)a(c[g],h[g],d[g]);else{p.multiDrawArraysInstancedWEBGL(i,c,0,h,0,d,0,u);let g=0;for(let v=0;v<u;v++)g+=h[v]*d[v];e.update(g,i,1)}}this.setMode=n,this.render=r,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function pm(s,t,e,i){let n;function r(){if(n!==void 0)return n;if(t.has("EXT_texture_filter_anisotropic")===!0){const C=t.get("EXT_texture_filter_anisotropic");n=s.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n}function a(C){return!(C!==Ke&&i.convert(C)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(C){const P=C===Is&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(C!==Mi&&i.convert(C)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_TYPE)&&C!==li&&!P)}function l(C){if(C==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp";const h=l(c);h!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const u=e.logarithmicDepthBuffer===!0,d=e.reverseDepthBuffer===!0&&t.has("EXT_clip_control"),p=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),g=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=s.getParameter(s.MAX_TEXTURE_SIZE),m=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),f=s.getParameter(s.MAX_VERTEX_ATTRIBS),M=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),y=s.getParameter(s.MAX_VARYING_VECTORS),x=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),I=g>0,A=s.getParameter(s.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:u,reverseDepthBuffer:d,maxTextures:p,maxVertexTextures:g,maxTextureSize:v,maxCubemapSize:m,maxAttributes:f,maxVertexUniforms:M,maxVaryings:y,maxFragmentUniforms:x,vertexTextures:I,maxSamples:A}}function mm(s){const t=this;let e=null,i=0,n=!1,r=!1;const a=new ji,o=new Vt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){const p=u.length!==0||d||i!==0||n;return n=d,i=u.length,p},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){e=h(u,d,0)},this.setState=function(u,d,p){const g=u.clippingPlanes,v=u.clipIntersection,m=u.clipShadows,f=s.get(u);if(!n||g===null||g.length===0||r&&!m)r?h(null):c();else{const M=r?0:i,y=M*4;let x=f.clippingState||null;l.value=x,x=h(g,d,y,p);for(let I=0;I!==y;++I)x[I]=e[I];f.clippingState=x,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=M}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=i>0),t.numPlanes=i,t.numIntersection=0}function h(u,d,p,g){const v=u!==null?u.length:0;let m=null;if(v!==0){if(m=l.value,g!==!0||m===null){const f=p+v*4,M=d.matrixWorldInverse;o.getNormalMatrix(M),(m===null||m.length<f)&&(m=new Float32Array(f));for(let y=0,x=p;y!==v;++y,x+=4)a.copy(u[y]).applyMatrix4(M,o),a.normal.toArray(m,x),m[x+3]=a.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=v,t.numIntersection=0,m}}function gm(s){let t=new WeakMap;function e(a,o){return o===Ba?a.mapping=Gn:o===Ha&&(a.mapping=Vn),a}function i(a){if(a&&a.isTexture){const o=a.mapping;if(o===Ba||o===Ha)if(t.has(a)){const l=t.get(a).texture;return e(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new Td(l.height);return c.fromEquirectangularTexture(s,a),t.set(a,c),a.addEventListener("dispose",n),e(c.texture,a.mapping)}else return null}}return a}function n(a){const o=a.target;o.removeEventListener("dispose",n);const l=t.get(o);l!==void 0&&(t.delete(o),l.dispose())}function r(){t=new WeakMap}return{get:i,dispose:r}}class oh extends sh{constructor(t=-1,e=1,i=1,n=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=i,this.bottom=n,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,i,n,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=i,this.view.offsetY=n,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,n=(this.top+this.bottom)/2;let r=i-t,a=i+t,o=n+e,l=n-e;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const In=4,Ll=[.125,.215,.35,.446,.526,.582],Qi=20,fa=new oh,Pl=new Ut;let pa=null,ma=0,ga=0,va=!1;const Zi=(1+Math.sqrt(5))/2,An=1/Zi,Il=[new R(-Zi,An,0),new R(Zi,An,0),new R(-An,0,Zi),new R(An,0,Zi),new R(0,Zi,-An),new R(0,Zi,An),new R(-1,1,-1),new R(1,1,-1),new R(-1,1,1),new R(1,1,1)];class Dl{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,i=.1,n=100){pa=this._renderer.getRenderTarget(),ma=this._renderer.getActiveCubeFace(),ga=this._renderer.getActiveMipmapLevel(),va=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,i,n,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=kl(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Nl(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(pa,ma,ga),this._renderer.xr.enabled=va,t.scissorTest=!1,ir(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Gn||t.mapping===Vn?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),pa=this._renderer.getRenderTarget(),ma=this._renderer.getActiveCubeFace(),ga=this._renderer.getActiveMipmapLevel(),va=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const i=e||this._allocateTargets();return this._textureToCubeUV(t,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,i={magFilter:oi,minFilter:oi,generateMipmaps:!1,type:Is,format:Ke,colorSpace:Kn,depthBuffer:!1},n=Ul(t,e,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Ul(t,e,i);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=vm(r)),this._blurMaterial=xm(r,t,e)}return n}_compileMaterial(t){const e=new gt(this._lodPlanes[0],t);this._renderer.compile(e,fa)}_sceneToCubeUV(t,e,i,n){const o=new We(90,1,e,i),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(Pl),h.toneMapping=ki,h.autoClear=!1;const p=new he({name:"PMREM.Background",side:De,depthWrite:!1,depthTest:!1}),g=new gt(new Fi,p);let v=!1;const m=t.background;m?m.isColor&&(p.color.copy(m),t.background=null,v=!0):(p.color.copy(Pl),v=!0);for(let f=0;f<6;f++){const M=f%3;M===0?(o.up.set(0,l[f],0),o.lookAt(c[f],0,0)):M===1?(o.up.set(0,0,l[f]),o.lookAt(0,c[f],0)):(o.up.set(0,l[f],0),o.lookAt(0,0,c[f]));const y=this._cubeSize;ir(n,M*y,f>2?y:0,y,y),h.setRenderTarget(n),v&&h.render(g,o),h.render(t,o)}g.geometry.dispose(),g.material.dispose(),h.toneMapping=d,h.autoClear=u,t.background=m}_textureToCubeUV(t,e){const i=this._renderer,n=t.mapping===Gn||t.mapping===Vn;n?(this._cubemapMaterial===null&&(this._cubemapMaterial=kl()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Nl());const r=n?this._cubemapMaterial:this._equirectMaterial,a=new gt(this._lodPlanes[0],r),o=r.uniforms;o.envMap.value=t;const l=this._cubeSize;ir(e,0,0,3*l,2*l),i.setRenderTarget(e),i.render(a,fa)}_applyPMREM(t){const e=this._renderer,i=e.autoClear;e.autoClear=!1;const n=this._lodPlanes.length;for(let r=1;r<n;r++){const a=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),o=Il[(n-r-1)%Il.length];this._blur(t,r-1,r,a,o)}e.autoClear=i}_blur(t,e,i,n,r){const a=this._pingPongRenderTarget;this._halfBlur(t,a,e,i,n,"latitudinal",r),this._halfBlur(a,t,i,i,n,"longitudinal",r)}_halfBlur(t,e,i,n,r,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,u=new gt(this._lodPlanes[n],c),d=c.uniforms,p=this._sizeLods[i]-1,g=isFinite(r)?Math.PI/(2*p):2*Math.PI/(2*Qi-1),v=r/g,m=isFinite(r)?1+Math.floor(h*v):Qi;m>Qi&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Qi}`);const f=[];let M=0;for(let C=0;C<Qi;++C){const P=C/v,S=Math.exp(-P*P/2);f.push(S),C===0?M+=S:C<m&&(M+=2*S)}for(let C=0;C<f.length;C++)f[C]=f[C]/M;d.envMap.value=t.texture,d.samples.value=m,d.weights.value=f,d.latitudinal.value=a==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:y}=this;d.dTheta.value=g,d.mipInt.value=y-i;const x=this._sizeLods[n],I=3*x*(n>y-In?n-y+In:0),A=4*(this._cubeSize-x);ir(e,I,A,3*x,2*x),l.setRenderTarget(e),l.render(u,fa)}}function vm(s){const t=[],e=[],i=[];let n=s;const r=s-In+1+Ll.length;for(let a=0;a<r;a++){const o=Math.pow(2,n);e.push(o);let l=1/o;a>s-In?l=Ll[a-s+In-1]:a===0&&(l=0),i.push(l);const c=1/(o-2),h=-c,u=1+c,d=[h,h,u,h,u,u,h,h,u,u,h,u],p=6,g=6,v=3,m=2,f=1,M=new Float32Array(v*g*p),y=new Float32Array(m*g*p),x=new Float32Array(f*g*p);for(let A=0;A<p;A++){const C=A%3*2/3-1,P=A>2?0:-1,S=[C,P,0,C+2/3,P,0,C+2/3,P+1,0,C,P,0,C+2/3,P+1,0,C,P+1,0];M.set(S,v*g*A),y.set(d,m*g*A);const _=[A,A,A,A,A,A];x.set(_,f*g*A)}const I=new ye;I.setAttribute("position",new Ae(M,v)),I.setAttribute("uv",new Ae(y,m)),I.setAttribute("faceIndex",new Ae(x,f)),t.push(I),n>In&&n--}return{lodPlanes:t,sizeLods:e,sigmas:i}}function Ul(s,t,e){const i=new rn(s,t,e);return i.texture.mapping=Pr,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function ir(s,t,e,i,n){s.viewport.set(t,e,i,n),s.scissor.set(t,e,i,n)}function xm(s,t,e){const i=new Float32Array(Qi),n=new R(0,1,0);return new Si({name:"SphericalGaussianBlur",defines:{n:Qi,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:n}},vertexShader:Bo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Ni,depthTest:!1,depthWrite:!1})}function Nl(){return new Si({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Bo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Ni,depthTest:!1,depthWrite:!1})}function kl(){return new Si({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Bo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Ni,depthTest:!1,depthWrite:!1})}function Bo(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function _m(s){let t=new WeakMap,e=null;function i(o){if(o&&o.isTexture){const l=o.mapping,c=l===Ba||l===Ha,h=l===Gn||l===Vn;if(c||h){let u=t.get(o);const d=u!==void 0?u.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==d)return e===null&&(e=new Dl(s)),u=c?e.fromEquirectangular(o,u):e.fromCubemap(o,u),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),u.texture;if(u!==void 0)return u.texture;{const p=o.image;return c&&p&&p.height>0||h&&p&&n(p)?(e===null&&(e=new Dl(s)),u=c?e.fromEquirectangular(o):e.fromCubemap(o),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),o.addEventListener("dispose",r),u.texture):null}}}return o}function n(o){let l=0;const c=6;for(let h=0;h<c;h++)o[h]!==void 0&&l++;return l===c}function r(o){const l=o.target;l.removeEventListener("dispose",r);const c=t.get(l);c!==void 0&&(t.delete(l),c.dispose())}function a(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:i,dispose:a}}function ym(s){const t={};function e(i){if(t[i]!==void 0)return t[i];let n;switch(i){case"WEBGL_depth_texture":n=s.getExtension("WEBGL_depth_texture")||s.getExtension("MOZ_WEBGL_depth_texture")||s.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":n=s.getExtension("EXT_texture_filter_anisotropic")||s.getExtension("MOZ_EXT_texture_filter_anisotropic")||s.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":n=s.getExtension("WEBGL_compressed_texture_s3tc")||s.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":n=s.getExtension("WEBGL_compressed_texture_pvrtc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:n=s.getExtension(i)}return t[i]=n,n}return{has:function(i){return e(i)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(i){const n=e(i);return n===null&&us("THREE.WebGLRenderer: "+i+" extension not supported."),n}}}function Mm(s,t,e,i){const n={},r=new WeakMap;function a(u){const d=u.target;d.index!==null&&t.remove(d.index);for(const g in d.attributes)t.remove(d.attributes[g]);for(const g in d.morphAttributes){const v=d.morphAttributes[g];for(let m=0,f=v.length;m<f;m++)t.remove(v[m])}d.removeEventListener("dispose",a),delete n[d.id];const p=r.get(d);p&&(t.remove(p),r.delete(d)),i.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function o(u,d){return n[d.id]===!0||(d.addEventListener("dispose",a),n[d.id]=!0,e.memory.geometries++),d}function l(u){const d=u.attributes;for(const g in d)t.update(d[g],s.ARRAY_BUFFER);const p=u.morphAttributes;for(const g in p){const v=p[g];for(let m=0,f=v.length;m<f;m++)t.update(v[m],s.ARRAY_BUFFER)}}function c(u){const d=[],p=u.index,g=u.attributes.position;let v=0;if(p!==null){const M=p.array;v=p.version;for(let y=0,x=M.length;y<x;y+=3){const I=M[y+0],A=M[y+1],C=M[y+2];d.push(I,A,A,C,C,I)}}else if(g!==void 0){const M=g.array;v=g.version;for(let y=0,x=M.length/3-1;y<x;y+=3){const I=y+0,A=y+1,C=y+2;d.push(I,A,A,C,C,I)}}else return;const m=new(jc(d)?ih:eh)(d,1);m.version=v;const f=r.get(u);f&&t.remove(f),r.set(u,m)}function h(u){const d=r.get(u);if(d){const p=u.index;p!==null&&d.version<p.version&&c(u)}else c(u);return r.get(u)}return{get:o,update:l,getWireframeAttribute:h}}function Sm(s,t,e){let i;function n(d){i=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function l(d,p){s.drawElements(i,p,r,d*a),e.update(p,i,1)}function c(d,p,g){g!==0&&(s.drawElementsInstanced(i,p,r,d*a,g),e.update(p,i,g))}function h(d,p,g){if(g===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,p,0,r,d,0,g);let m=0;for(let f=0;f<g;f++)m+=p[f];e.update(m,i,1)}function u(d,p,g,v){if(g===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let f=0;f<d.length;f++)c(d[f]/a,p[f],v[f]);else{m.multiDrawElementsInstancedWEBGL(i,p,0,r,d,0,v,0,g);let f=0;for(let M=0;M<g;M++)f+=p[M]*v[M];e.update(f,i,1)}}this.setMode=n,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function bm(s){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function i(r,a,o){switch(e.calls++,a){case s.TRIANGLES:e.triangles+=o*(r/3);break;case s.LINES:e.lines+=o*(r/2);break;case s.LINE_STRIP:e.lines+=o*(r-1);break;case s.LINE_LOOP:e.lines+=o*r;break;case s.POINTS:e.points+=o*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function n(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:n,update:i}}function wm(s,t,e){const i=new WeakMap,n=new ae;function r(a,o,l){const c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0;let d=i.get(o);if(d===void 0||d.count!==u){let _=function(){P.dispose(),i.delete(o),o.removeEventListener("dispose",_)};var p=_;d!==void 0&&d.texture.dispose();const g=o.morphAttributes.position!==void 0,v=o.morphAttributes.normal!==void 0,m=o.morphAttributes.color!==void 0,f=o.morphAttributes.position||[],M=o.morphAttributes.normal||[],y=o.morphAttributes.color||[];let x=0;g===!0&&(x=1),v===!0&&(x=2),m===!0&&(x=3);let I=o.attributes.position.count*x,A=1;I>t.maxTextureSize&&(A=Math.ceil(I/t.maxTextureSize),I=t.maxTextureSize);const C=new Float32Array(I*A*4*u),P=new Jc(C,I,A,u);P.type=li,P.needsUpdate=!0;const S=x*4;for(let L=0;L<u;L++){const O=f[L],F=M[L],G=y[L],q=I*A*4*L;for(let W=0;W<O.count;W++){const Z=W*S;g===!0&&(n.fromBufferAttribute(O,W),C[q+Z+0]=n.x,C[q+Z+1]=n.y,C[q+Z+2]=n.z,C[q+Z+3]=0),v===!0&&(n.fromBufferAttribute(F,W),C[q+Z+4]=n.x,C[q+Z+5]=n.y,C[q+Z+6]=n.z,C[q+Z+7]=0),m===!0&&(n.fromBufferAttribute(G,W),C[q+Z+8]=n.x,C[q+Z+9]=n.y,C[q+Z+10]=n.z,C[q+Z+11]=G.itemSize===4?n.w:1)}}d={count:u,texture:P,size:new lt(I,A)},i.set(o,d),o.addEventListener("dispose",_)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(s,"morphTexture",a.morphTexture,e);else{let g=0;for(let m=0;m<c.length;m++)g+=c[m];const v=o.morphTargetsRelative?1:1-g;l.getUniforms().setValue(s,"morphTargetBaseInfluence",v),l.getUniforms().setValue(s,"morphTargetInfluences",c)}l.getUniforms().setValue(s,"morphTargetsTexture",d.texture,e),l.getUniforms().setValue(s,"morphTargetsTextureSize",d.size)}return{update:r}}function Em(s,t,e,i){let n=new WeakMap;function r(l){const c=i.render.frame,h=l.geometry,u=t.get(l,h);if(n.get(u)!==c&&(t.update(u),n.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),n.get(l)!==c&&(e.update(l.instanceMatrix,s.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,s.ARRAY_BUFFER),n.set(l,c))),l.isSkinnedMesh){const d=l.skeleton;n.get(d)!==c&&(d.update(),n.set(d,c))}return u}function a(){n=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:r,dispose:a}}class lh extends Ue{constructor(t,e,i,n,r,a,o,l,c,h=kn){if(h!==kn&&h!==Xn)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");i===void 0&&h===kn&&(i=sn),i===void 0&&h===Xn&&(i=Wn),super(null,n,r,a,o,l,h,i,c),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=o!==void 0?o:Oe,this.minFilter=l!==void 0?l:Oe,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const ch=new Ue,Ol=new lh(1,1),hh=new Jc,uh=new hd,dh=new rh,Fl=[],zl=[],Bl=new Float32Array(16),Hl=new Float32Array(9),Gl=new Float32Array(4);function jn(s,t,e){const i=s[0];if(i<=0||i>0)return s;const n=t*e;let r=Fl[n];if(r===void 0&&(r=new Float32Array(n),Fl[n]=r),t!==0){i.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,s[a].toArray(r,o)}return r}function be(s,t){if(s.length!==t.length)return!1;for(let e=0,i=s.length;e<i;e++)if(s[e]!==t[e])return!1;return!0}function we(s,t){for(let e=0,i=t.length;e<i;e++)s[e]=t[e]}function Ur(s,t){let e=zl[t];e===void 0&&(e=new Int32Array(t),zl[t]=e);for(let i=0;i!==t;++i)e[i]=s.allocateTextureUnit();return e}function Tm(s,t){const e=this.cache;e[0]!==t&&(s.uniform1f(this.addr,t),e[0]=t)}function Am(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(be(e,t))return;s.uniform2fv(this.addr,t),we(e,t)}}function Rm(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(s.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(be(e,t))return;s.uniform3fv(this.addr,t),we(e,t)}}function Cm(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(be(e,t))return;s.uniform4fv(this.addr,t),we(e,t)}}function Lm(s,t){const e=this.cache,i=t.elements;if(i===void 0){if(be(e,t))return;s.uniformMatrix2fv(this.addr,!1,t),we(e,t)}else{if(be(e,i))return;Gl.set(i),s.uniformMatrix2fv(this.addr,!1,Gl),we(e,i)}}function Pm(s,t){const e=this.cache,i=t.elements;if(i===void 0){if(be(e,t))return;s.uniformMatrix3fv(this.addr,!1,t),we(e,t)}else{if(be(e,i))return;Hl.set(i),s.uniformMatrix3fv(this.addr,!1,Hl),we(e,i)}}function Im(s,t){const e=this.cache,i=t.elements;if(i===void 0){if(be(e,t))return;s.uniformMatrix4fv(this.addr,!1,t),we(e,t)}else{if(be(e,i))return;Bl.set(i),s.uniformMatrix4fv(this.addr,!1,Bl),we(e,i)}}function Dm(s,t){const e=this.cache;e[0]!==t&&(s.uniform1i(this.addr,t),e[0]=t)}function Um(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(be(e,t))return;s.uniform2iv(this.addr,t),we(e,t)}}function Nm(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(be(e,t))return;s.uniform3iv(this.addr,t),we(e,t)}}function km(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(be(e,t))return;s.uniform4iv(this.addr,t),we(e,t)}}function Om(s,t){const e=this.cache;e[0]!==t&&(s.uniform1ui(this.addr,t),e[0]=t)}function Fm(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(be(e,t))return;s.uniform2uiv(this.addr,t),we(e,t)}}function zm(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(be(e,t))return;s.uniform3uiv(this.addr,t),we(e,t)}}function Bm(s,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(be(e,t))return;s.uniform4uiv(this.addr,t),we(e,t)}}function Hm(s,t,e){const i=this.cache,n=e.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n);let r;this.type===s.SAMPLER_2D_SHADOW?(Ol.compareFunction=$c,r=Ol):r=ch,e.setTexture2D(t||r,n)}function Gm(s,t,e){const i=this.cache,n=e.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n),e.setTexture3D(t||uh,n)}function Vm(s,t,e){const i=this.cache,n=e.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n),e.setTextureCube(t||dh,n)}function Wm(s,t,e){const i=this.cache,n=e.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n),e.setTexture2DArray(t||hh,n)}function Xm(s){switch(s){case 5126:return Tm;case 35664:return Am;case 35665:return Rm;case 35666:return Cm;case 35674:return Lm;case 35675:return Pm;case 35676:return Im;case 5124:case 35670:return Dm;case 35667:case 35671:return Um;case 35668:case 35672:return Nm;case 35669:case 35673:return km;case 5125:return Om;case 36294:return Fm;case 36295:return zm;case 36296:return Bm;case 35678:case 36198:case 36298:case 36306:case 35682:return Hm;case 35679:case 36299:case 36307:return Gm;case 35680:case 36300:case 36308:case 36293:return Vm;case 36289:case 36303:case 36311:case 36292:return Wm}}function qm(s,t){s.uniform1fv(this.addr,t)}function Ym(s,t){const e=jn(t,this.size,2);s.uniform2fv(this.addr,e)}function Km(s,t){const e=jn(t,this.size,3);s.uniform3fv(this.addr,e)}function $m(s,t){const e=jn(t,this.size,4);s.uniform4fv(this.addr,e)}function jm(s,t){const e=jn(t,this.size,4);s.uniformMatrix2fv(this.addr,!1,e)}function Zm(s,t){const e=jn(t,this.size,9);s.uniformMatrix3fv(this.addr,!1,e)}function Jm(s,t){const e=jn(t,this.size,16);s.uniformMatrix4fv(this.addr,!1,e)}function Qm(s,t){s.uniform1iv(this.addr,t)}function t0(s,t){s.uniform2iv(this.addr,t)}function e0(s,t){s.uniform3iv(this.addr,t)}function i0(s,t){s.uniform4iv(this.addr,t)}function n0(s,t){s.uniform1uiv(this.addr,t)}function s0(s,t){s.uniform2uiv(this.addr,t)}function r0(s,t){s.uniform3uiv(this.addr,t)}function a0(s,t){s.uniform4uiv(this.addr,t)}function o0(s,t,e){const i=this.cache,n=t.length,r=Ur(e,n);be(i,r)||(s.uniform1iv(this.addr,r),we(i,r));for(let a=0;a!==n;++a)e.setTexture2D(t[a]||ch,r[a])}function l0(s,t,e){const i=this.cache,n=t.length,r=Ur(e,n);be(i,r)||(s.uniform1iv(this.addr,r),we(i,r));for(let a=0;a!==n;++a)e.setTexture3D(t[a]||uh,r[a])}function c0(s,t,e){const i=this.cache,n=t.length,r=Ur(e,n);be(i,r)||(s.uniform1iv(this.addr,r),we(i,r));for(let a=0;a!==n;++a)e.setTextureCube(t[a]||dh,r[a])}function h0(s,t,e){const i=this.cache,n=t.length,r=Ur(e,n);be(i,r)||(s.uniform1iv(this.addr,r),we(i,r));for(let a=0;a!==n;++a)e.setTexture2DArray(t[a]||hh,r[a])}function u0(s){switch(s){case 5126:return qm;case 35664:return Ym;case 35665:return Km;case 35666:return $m;case 35674:return jm;case 35675:return Zm;case 35676:return Jm;case 5124:case 35670:return Qm;case 35667:case 35671:return t0;case 35668:case 35672:return e0;case 35669:case 35673:return i0;case 5125:return n0;case 36294:return s0;case 36295:return r0;case 36296:return a0;case 35678:case 36198:case 36298:case 36306:case 35682:return o0;case 35679:case 36299:case 36307:return l0;case 35680:case 36300:case 36308:case 36293:return c0;case 36289:case 36303:case 36311:case 36292:return h0}}class d0{constructor(t,e,i){this.id=t,this.addr=i,this.cache=[],this.type=e.type,this.setValue=Xm(e.type)}}class f0{constructor(t,e,i){this.id=t,this.addr=i,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=u0(e.type)}}class p0{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,i){const n=this.seq;for(let r=0,a=n.length;r!==a;++r){const o=n[r];o.setValue(t,e[o.id],i)}}}const xa=/(\w+)(\])?(\[|\.)?/g;function Vl(s,t){s.seq.push(t),s.map[t.id]=t}function m0(s,t,e){const i=s.name,n=i.length;for(xa.lastIndex=0;;){const r=xa.exec(i),a=xa.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===n){Vl(e,c===void 0?new d0(o,s,t):new f0(o,s,t));break}else{let u=e.map[o];u===void 0&&(u=new p0(o),Vl(e,u)),e=u}}}class Mr{constructor(t,e){this.seq=[],this.map={};const i=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let n=0;n<i;++n){const r=t.getActiveUniform(e,n),a=t.getUniformLocation(e,r.name);m0(r,a,this)}}setValue(t,e,i,n){const r=this.map[e];r!==void 0&&r.setValue(t,i,n)}setOptional(t,e,i){const n=e[i];n!==void 0&&this.setValue(t,i,n)}static upload(t,e,i,n){for(let r=0,a=e.length;r!==a;++r){const o=e[r],l=i[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,n)}}static seqWithValue(t,e){const i=[];for(let n=0,r=t.length;n!==r;++n){const a=t[n];a.id in e&&i.push(a)}return i}}function Wl(s,t,e){const i=s.createShader(t);return s.shaderSource(i,e),s.compileShader(i),i}const g0=37297;let v0=0;function x0(s,t){const e=s.split(`
`),i=[],n=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=n;a<r;a++){const o=a+1;i.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return i.join(`
`)}const Xl=new Vt;function _0(s){Jt._getMatrix(Xl,Jt.workingColorSpace,s);const t=`mat3( ${Xl.elements.map(e=>e.toFixed(4))} )`;switch(Jt.getTransfer(s)){case Ir:return[t,"LinearTransferOETF"];case re:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",s),[t,"LinearTransferOETF"]}}function ql(s,t,e){const i=s.getShaderParameter(t,s.COMPILE_STATUS),n=s.getShaderInfoLog(t).trim();if(i&&n==="")return"";const r=/ERROR: 0:(\d+)/.exec(n);if(r){const a=parseInt(r[1]);return e.toUpperCase()+`

`+n+`

`+x0(s.getShaderSource(t),a)}else return n}function y0(s,t){const e=_0(t);return[`vec4 ${s}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function M0(s,t){let e;switch(t){case Su:e="Linear";break;case bu:e="Reinhard";break;case wu:e="Cineon";break;case Fc:e="ACESFilmic";break;case Tu:e="AgX";break;case Au:e="Neutral";break;case Eu:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+s+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}const nr=new R;function S0(){Jt.getLuminanceCoefficients(nr);const s=nr.x.toFixed(4),t=nr.y.toFixed(4),e=nr.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${s}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function b0(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",s.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ds).join(`
`)}function w0(s){const t=[];for(const e in s){const i=s[e];i!==!1&&t.push("#define "+e+" "+i)}return t.join(`
`)}function E0(s,t){const e={},i=s.getProgramParameter(t,s.ACTIVE_ATTRIBUTES);for(let n=0;n<i;n++){const r=s.getActiveAttrib(t,n),a=r.name;let o=1;r.type===s.FLOAT_MAT2&&(o=2),r.type===s.FLOAT_MAT3&&(o=3),r.type===s.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:s.getAttribLocation(t,a),locationSize:o}}return e}function ds(s){return s!==""}function Yl(s,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return s.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Kl(s,t){return s.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const T0=/^[ \t]*#include +<([\w\d./]+)>/gm;function go(s){return s.replace(T0,R0)}const A0=new Map;function R0(s,t){let e=Xt[t];if(e===void 0){const i=A0.get(t);if(i!==void 0)e=Xt[i],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw new Error("Can not resolve #include <"+t+">")}return go(e)}const C0=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function $l(s){return s.replace(C0,L0)}function L0(s,t,e,i){let n="";for(let r=parseInt(t);r<parseInt(e);r++)n+=i.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return n}function jl(s){let t=`precision ${s.precision} float;
	precision ${s.precision} int;
	precision ${s.precision} sampler2D;
	precision ${s.precision} samplerCube;
	precision ${s.precision} sampler3D;
	precision ${s.precision} sampler2DArray;
	precision ${s.precision} sampler2DShadow;
	precision ${s.precision} samplerCubeShadow;
	precision ${s.precision} sampler2DArrayShadow;
	precision ${s.precision} isampler2D;
	precision ${s.precision} isampler3D;
	precision ${s.precision} isamplerCube;
	precision ${s.precision} isampler2DArray;
	precision ${s.precision} usampler2D;
	precision ${s.precision} usampler3D;
	precision ${s.precision} usamplerCube;
	precision ${s.precision} usampler2DArray;
	`;return s.precision==="highp"?t+=`
#define HIGH_PRECISION`:s.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function P0(s){let t="SHADOWMAP_TYPE_BASIC";return s.shadowMapType===Nc?t="SHADOWMAP_TYPE_PCF":s.shadowMapType===kc?t="SHADOWMAP_TYPE_PCF_SOFT":s.shadowMapType===xi&&(t="SHADOWMAP_TYPE_VSM"),t}function I0(s){let t="ENVMAP_TYPE_CUBE";if(s.envMap)switch(s.envMapMode){case Gn:case Vn:t="ENVMAP_TYPE_CUBE";break;case Pr:t="ENVMAP_TYPE_CUBE_UV";break}return t}function D0(s){let t="ENVMAP_MODE_REFLECTION";if(s.envMap)switch(s.envMapMode){case Vn:t="ENVMAP_MODE_REFRACTION";break}return t}function U0(s){let t="ENVMAP_BLENDING_NONE";if(s.envMap)switch(s.combine){case Oc:t="ENVMAP_BLENDING_MULTIPLY";break;case yu:t="ENVMAP_BLENDING_MIX";break;case Mu:t="ENVMAP_BLENDING_ADD";break}return t}function N0(s){const t=s.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),7*16)),texelHeight:i,maxMip:e}}function k0(s,t,e,i){const n=s.getContext(),r=e.defines;let a=e.vertexShader,o=e.fragmentShader;const l=P0(e),c=I0(e),h=D0(e),u=U0(e),d=N0(e),p=b0(e),g=w0(r),v=n.createProgram();let m,f,M=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(ds).join(`
`),m.length>0&&(m+=`
`),f=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(ds).join(`
`),f.length>0&&(f+=`
`)):(m=[jl(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ds).join(`
`),f=[jl(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==ki?"#define TONE_MAPPING":"",e.toneMapping!==ki?Xt.tonemapping_pars_fragment:"",e.toneMapping!==ki?M0("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Xt.colorspace_pars_fragment,y0("linearToOutputTexel",e.outputColorSpace),S0(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(ds).join(`
`)),a=go(a),a=Yl(a,e),a=Kl(a,e),o=go(o),o=Yl(o,e),o=Kl(o,e),a=$l(a),o=$l(o),e.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,f=["#define varying in",e.glslVersion===ll?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===ll?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);const y=M+m+a,x=M+f+o,I=Wl(n,n.VERTEX_SHADER,y),A=Wl(n,n.FRAGMENT_SHADER,x);n.attachShader(v,I),n.attachShader(v,A),e.index0AttributeName!==void 0?n.bindAttribLocation(v,0,e.index0AttributeName):e.morphTargets===!0&&n.bindAttribLocation(v,0,"position"),n.linkProgram(v);function C(L){if(s.debug.checkShaderErrors){const O=n.getProgramInfoLog(v).trim(),F=n.getShaderInfoLog(I).trim(),G=n.getShaderInfoLog(A).trim();let q=!0,W=!0;if(n.getProgramParameter(v,n.LINK_STATUS)===!1)if(q=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(n,v,I,A);else{const Z=ql(n,I,"vertex"),V=ql(n,A,"fragment");console.error("THREE.WebGLProgram: Shader Error "+n.getError()+" - VALIDATE_STATUS "+n.getProgramParameter(v,n.VALIDATE_STATUS)+`

Material Name: `+L.name+`
Material Type: `+L.type+`

Program Info Log: `+O+`
`+Z+`
`+V)}else O!==""?console.warn("THREE.WebGLProgram: Program Info Log:",O):(F===""||G==="")&&(W=!1);W&&(L.diagnostics={runnable:q,programLog:O,vertexShader:{log:F,prefix:m},fragmentShader:{log:G,prefix:f}})}n.deleteShader(I),n.deleteShader(A),P=new Mr(n,v),S=E0(n,v)}let P;this.getUniforms=function(){return P===void 0&&C(this),P};let S;this.getAttributes=function(){return S===void 0&&C(this),S};let _=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return _===!1&&(_=n.getProgramParameter(v,g0)),_},this.destroy=function(){i.releaseStatesOfProgram(this),n.deleteProgram(v),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=v0++,this.cacheKey=t,this.usedTimes=1,this.program=v,this.vertexShader=I,this.fragmentShader=A,this}let O0=0;class F0{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,i=t.fragmentShader,n=this._getShaderStage(e),r=this._getShaderStage(i),a=this._getShaderCacheForMaterial(t);return a.has(n)===!1&&(a.add(n),n.usedTimes++),a.has(r)===!1&&(a.add(r),r.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const i of e)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let i=e.get(t);return i===void 0&&(i=new Set,e.set(t,i)),i}_getShaderStage(t){const e=this.shaderCache;let i=e.get(t);return i===void 0&&(i=new z0(t),e.set(t,i)),i}}class z0{constructor(t){this.id=O0++,this.code=t,this.usedTimes=0}}function B0(s,t,e,i,n,r,a){const o=new Qc,l=new F0,c=new Set,h=[],u=n.logarithmicDepthBuffer,d=n.vertexTextures;let p=n.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function v(S){return c.add(S),S===0?"uv":`uv${S}`}function m(S,_,L,O,F){const G=O.fog,q=F.geometry,W=S.isMeshStandardMaterial?O.environment:null,Z=(S.isMeshStandardMaterial?e:t).get(S.envMap||W),V=Z&&Z.mapping===Pr?Z.image.height:null,ct=g[S.type];S.precision!==null&&(p=n.getMaxPrecision(S.precision),p!==S.precision&&console.warn("THREE.WebGLProgram.getParameters:",S.precision,"not supported, using",p,"instead."));const ht=q.morphAttributes.position||q.morphAttributes.normal||q.morphAttributes.color,Mt=ht!==void 0?ht.length:0;let zt=0;q.morphAttributes.position!==void 0&&(zt=1),q.morphAttributes.normal!==void 0&&(zt=2),q.morphAttributes.color!==void 0&&(zt=3);let jt,Y,nt,St;if(ct){const ie=ai[ct];jt=ie.vertexShader,Y=ie.fragmentShader}else jt=S.vertexShader,Y=S.fragmentShader,l.update(S),nt=l.getVertexShaderID(S),St=l.getFragmentShaderID(S);const at=s.getRenderTarget(),Lt=s.state.buffers.depth.getReversed(),kt=F.isInstancedMesh===!0,Nt=F.isBatchedMesh===!0,qt=!!S.map,Q=!!S.matcap,st=!!Z,T=!!S.aoMap,et=!!S.lightMap,j=!!S.bumpMap,ut=!!S.normalMap,ot=!!S.displacementMap,Dt=!!S.emissiveMap,mt=!!S.metalnessMap,E=!!S.roughnessMap,b=S.anisotropy>0,z=S.clearcoat>0,K=S.dispersion>0,tt=S.iridescence>0,$=S.sheen>0,Et=S.transmission>0,ft=b&&!!S.anisotropyMap,yt=z&&!!S.clearcoatMap,Yt=z&&!!S.clearcoatNormalMap,it=z&&!!S.clearcoatRoughnessMap,bt=tt&&!!S.iridescenceMap,Ot=tt&&!!S.iridescenceThicknessMap,Ft=$&&!!S.sheenColorMap,wt=$&&!!S.sheenRoughnessMap,Kt=!!S.specularMap,Wt=!!S.specularColorMap,oe=!!S.specularIntensityMap,D=Et&&!!S.transmissionMap,pt=Et&&!!S.thicknessMap,X=!!S.gradientMap,J=!!S.alphaMap,_t=S.alphaTest>0,vt=!!S.alphaHash,Ht=!!S.extensions;let ge=ki;S.toneMapped&&(at===null||at.isXRRenderTarget===!0)&&(ge=s.toneMapping);const Ce={shaderID:ct,shaderType:S.type,shaderName:S.name,vertexShader:jt,fragmentShader:Y,defines:S.defines,customVertexShaderID:nt,customFragmentShaderID:St,isRawShaderMaterial:S.isRawShaderMaterial===!0,glslVersion:S.glslVersion,precision:p,batching:Nt,batchingColor:Nt&&F._colorsTexture!==null,instancing:kt,instancingColor:kt&&F.instanceColor!==null,instancingMorph:kt&&F.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:at===null?s.outputColorSpace:at.isXRRenderTarget===!0?at.texture.colorSpace:Kn,alphaToCoverage:!!S.alphaToCoverage,map:qt,matcap:Q,envMap:st,envMapMode:st&&Z.mapping,envMapCubeUVHeight:V,aoMap:T,lightMap:et,bumpMap:j,normalMap:ut,displacementMap:d&&ot,emissiveMap:Dt,normalMapObjectSpace:ut&&S.normalMapType===Pu,normalMapTangentSpace:ut&&S.normalMapType===ko,metalnessMap:mt,roughnessMap:E,anisotropy:b,anisotropyMap:ft,clearcoat:z,clearcoatMap:yt,clearcoatNormalMap:Yt,clearcoatRoughnessMap:it,dispersion:K,iridescence:tt,iridescenceMap:bt,iridescenceThicknessMap:Ot,sheen:$,sheenColorMap:Ft,sheenRoughnessMap:wt,specularMap:Kt,specularColorMap:Wt,specularIntensityMap:oe,transmission:Et,transmissionMap:D,thicknessMap:pt,gradientMap:X,opaque:S.transparent===!1&&S.blending===Nn&&S.alphaToCoverage===!1,alphaMap:J,alphaTest:_t,alphaHash:vt,combine:S.combine,mapUv:qt&&v(S.map.channel),aoMapUv:T&&v(S.aoMap.channel),lightMapUv:et&&v(S.lightMap.channel),bumpMapUv:j&&v(S.bumpMap.channel),normalMapUv:ut&&v(S.normalMap.channel),displacementMapUv:ot&&v(S.displacementMap.channel),emissiveMapUv:Dt&&v(S.emissiveMap.channel),metalnessMapUv:mt&&v(S.metalnessMap.channel),roughnessMapUv:E&&v(S.roughnessMap.channel),anisotropyMapUv:ft&&v(S.anisotropyMap.channel),clearcoatMapUv:yt&&v(S.clearcoatMap.channel),clearcoatNormalMapUv:Yt&&v(S.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:it&&v(S.clearcoatRoughnessMap.channel),iridescenceMapUv:bt&&v(S.iridescenceMap.channel),iridescenceThicknessMapUv:Ot&&v(S.iridescenceThicknessMap.channel),sheenColorMapUv:Ft&&v(S.sheenColorMap.channel),sheenRoughnessMapUv:wt&&v(S.sheenRoughnessMap.channel),specularMapUv:Kt&&v(S.specularMap.channel),specularColorMapUv:Wt&&v(S.specularColorMap.channel),specularIntensityMapUv:oe&&v(S.specularIntensityMap.channel),transmissionMapUv:D&&v(S.transmissionMap.channel),thicknessMapUv:pt&&v(S.thicknessMap.channel),alphaMapUv:J&&v(S.alphaMap.channel),vertexTangents:!!q.attributes.tangent&&(ut||b),vertexColors:S.vertexColors,vertexAlphas:S.vertexColors===!0&&!!q.attributes.color&&q.attributes.color.itemSize===4,pointsUvs:F.isPoints===!0&&!!q.attributes.uv&&(qt||J),fog:!!G,useFog:S.fog===!0,fogExp2:!!G&&G.isFogExp2,flatShading:S.flatShading===!0,sizeAttenuation:S.sizeAttenuation===!0,logarithmicDepthBuffer:u,reverseDepthBuffer:Lt,skinning:F.isSkinnedMesh===!0,morphTargets:q.morphAttributes.position!==void 0,morphNormals:q.morphAttributes.normal!==void 0,morphColors:q.morphAttributes.color!==void 0,morphTargetsCount:Mt,morphTextureStride:zt,numDirLights:_.directional.length,numPointLights:_.point.length,numSpotLights:_.spot.length,numSpotLightMaps:_.spotLightMap.length,numRectAreaLights:_.rectArea.length,numHemiLights:_.hemi.length,numDirLightShadows:_.directionalShadowMap.length,numPointLightShadows:_.pointShadowMap.length,numSpotLightShadows:_.spotShadowMap.length,numSpotLightShadowsWithMaps:_.numSpotLightShadowsWithMaps,numLightProbes:_.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:S.dithering,shadowMapEnabled:s.shadowMap.enabled&&L.length>0,shadowMapType:s.shadowMap.type,toneMapping:ge,decodeVideoTexture:qt&&S.map.isVideoTexture===!0&&Jt.getTransfer(S.map.colorSpace)===re,decodeVideoTextureEmissive:Dt&&S.emissiveMap.isVideoTexture===!0&&Jt.getTransfer(S.emissiveMap.colorSpace)===re,premultipliedAlpha:S.premultipliedAlpha,doubleSided:S.side===Re,flipSided:S.side===De,useDepthPacking:S.depthPacking>=0,depthPacking:S.depthPacking||0,index0AttributeName:S.index0AttributeName,extensionClipCullDistance:Ht&&S.extensions.clipCullDistance===!0&&i.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Ht&&S.extensions.multiDraw===!0||Nt)&&i.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:i.has("KHR_parallel_shader_compile"),customProgramCacheKey:S.customProgramCacheKey()};return Ce.vertexUv1s=c.has(1),Ce.vertexUv2s=c.has(2),Ce.vertexUv3s=c.has(3),c.clear(),Ce}function f(S){const _=[];if(S.shaderID?_.push(S.shaderID):(_.push(S.customVertexShaderID),_.push(S.customFragmentShaderID)),S.defines!==void 0)for(const L in S.defines)_.push(L),_.push(S.defines[L]);return S.isRawShaderMaterial===!1&&(M(_,S),y(_,S),_.push(s.outputColorSpace)),_.push(S.customProgramCacheKey),_.join()}function M(S,_){S.push(_.precision),S.push(_.outputColorSpace),S.push(_.envMapMode),S.push(_.envMapCubeUVHeight),S.push(_.mapUv),S.push(_.alphaMapUv),S.push(_.lightMapUv),S.push(_.aoMapUv),S.push(_.bumpMapUv),S.push(_.normalMapUv),S.push(_.displacementMapUv),S.push(_.emissiveMapUv),S.push(_.metalnessMapUv),S.push(_.roughnessMapUv),S.push(_.anisotropyMapUv),S.push(_.clearcoatMapUv),S.push(_.clearcoatNormalMapUv),S.push(_.clearcoatRoughnessMapUv),S.push(_.iridescenceMapUv),S.push(_.iridescenceThicknessMapUv),S.push(_.sheenColorMapUv),S.push(_.sheenRoughnessMapUv),S.push(_.specularMapUv),S.push(_.specularColorMapUv),S.push(_.specularIntensityMapUv),S.push(_.transmissionMapUv),S.push(_.thicknessMapUv),S.push(_.combine),S.push(_.fogExp2),S.push(_.sizeAttenuation),S.push(_.morphTargetsCount),S.push(_.morphAttributeCount),S.push(_.numDirLights),S.push(_.numPointLights),S.push(_.numSpotLights),S.push(_.numSpotLightMaps),S.push(_.numHemiLights),S.push(_.numRectAreaLights),S.push(_.numDirLightShadows),S.push(_.numPointLightShadows),S.push(_.numSpotLightShadows),S.push(_.numSpotLightShadowsWithMaps),S.push(_.numLightProbes),S.push(_.shadowMapType),S.push(_.toneMapping),S.push(_.numClippingPlanes),S.push(_.numClipIntersection),S.push(_.depthPacking)}function y(S,_){o.disableAll(),_.supportsVertexTextures&&o.enable(0),_.instancing&&o.enable(1),_.instancingColor&&o.enable(2),_.instancingMorph&&o.enable(3),_.matcap&&o.enable(4),_.envMap&&o.enable(5),_.normalMapObjectSpace&&o.enable(6),_.normalMapTangentSpace&&o.enable(7),_.clearcoat&&o.enable(8),_.iridescence&&o.enable(9),_.alphaTest&&o.enable(10),_.vertexColors&&o.enable(11),_.vertexAlphas&&o.enable(12),_.vertexUv1s&&o.enable(13),_.vertexUv2s&&o.enable(14),_.vertexUv3s&&o.enable(15),_.vertexTangents&&o.enable(16),_.anisotropy&&o.enable(17),_.alphaHash&&o.enable(18),_.batching&&o.enable(19),_.dispersion&&o.enable(20),_.batchingColor&&o.enable(21),S.push(o.mask),o.disableAll(),_.fog&&o.enable(0),_.useFog&&o.enable(1),_.flatShading&&o.enable(2),_.logarithmicDepthBuffer&&o.enable(3),_.reverseDepthBuffer&&o.enable(4),_.skinning&&o.enable(5),_.morphTargets&&o.enable(6),_.morphNormals&&o.enable(7),_.morphColors&&o.enable(8),_.premultipliedAlpha&&o.enable(9),_.shadowMapEnabled&&o.enable(10),_.doubleSided&&o.enable(11),_.flipSided&&o.enable(12),_.useDepthPacking&&o.enable(13),_.dithering&&o.enable(14),_.transmission&&o.enable(15),_.sheen&&o.enable(16),_.opaque&&o.enable(17),_.pointsUvs&&o.enable(18),_.decodeVideoTexture&&o.enable(19),_.decodeVideoTextureEmissive&&o.enable(20),_.alphaToCoverage&&o.enable(21),S.push(o.mask)}function x(S){const _=g[S.type];let L;if(_){const O=ai[_];L=Sd.clone(O.uniforms)}else L=S.uniforms;return L}function I(S,_){let L;for(let O=0,F=h.length;O<F;O++){const G=h[O];if(G.cacheKey===_){L=G,++L.usedTimes;break}}return L===void 0&&(L=new k0(s,_,S,r),h.push(L)),L}function A(S){if(--S.usedTimes===0){const _=h.indexOf(S);h[_]=h[h.length-1],h.pop(),S.destroy()}}function C(S){l.remove(S)}function P(){l.dispose()}return{getParameters:m,getProgramCacheKey:f,getUniforms:x,acquireProgram:I,releaseProgram:A,releaseShaderCache:C,programs:h,dispose:P}}function H0(){let s=new WeakMap;function t(a){return s.has(a)}function e(a){let o=s.get(a);return o===void 0&&(o={},s.set(a,o)),o}function i(a){s.delete(a)}function n(a,o,l){s.get(a)[o]=l}function r(){s=new WeakMap}return{has:t,get:e,remove:i,update:n,dispose:r}}function G0(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.material.id!==t.material.id?s.material.id-t.material.id:s.z!==t.z?s.z-t.z:s.id-t.id}function Zl(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.z!==t.z?t.z-s.z:s.id-t.id}function Jl(){const s=[];let t=0;const e=[],i=[],n=[];function r(){t=0,e.length=0,i.length=0,n.length=0}function a(u,d,p,g,v,m){let f=s[t];return f===void 0?(f={id:u.id,object:u,geometry:d,material:p,groupOrder:g,renderOrder:u.renderOrder,z:v,group:m},s[t]=f):(f.id=u.id,f.object=u,f.geometry=d,f.material=p,f.groupOrder=g,f.renderOrder=u.renderOrder,f.z=v,f.group=m),t++,f}function o(u,d,p,g,v,m){const f=a(u,d,p,g,v,m);p.transmission>0?i.push(f):p.transparent===!0?n.push(f):e.push(f)}function l(u,d,p,g,v,m){const f=a(u,d,p,g,v,m);p.transmission>0?i.unshift(f):p.transparent===!0?n.unshift(f):e.unshift(f)}function c(u,d){e.length>1&&e.sort(u||G0),i.length>1&&i.sort(d||Zl),n.length>1&&n.sort(d||Zl)}function h(){for(let u=t,d=s.length;u<d;u++){const p=s[u];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:e,transmissive:i,transparent:n,init:r,push:o,unshift:l,finish:h,sort:c}}function V0(){let s=new WeakMap;function t(i,n){const r=s.get(i);let a;return r===void 0?(a=new Jl,s.set(i,[a])):n>=r.length?(a=new Jl,r.push(a)):a=r[n],a}function e(){s=new WeakMap}return{get:t,dispose:e}}function W0(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new R,color:new Ut};break;case"SpotLight":e={position:new R,direction:new R,color:new Ut,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new R,color:new Ut,distance:0,decay:0};break;case"HemisphereLight":e={direction:new R,skyColor:new Ut,groundColor:new Ut};break;case"RectAreaLight":e={color:new Ut,position:new R,halfWidth:new R,halfHeight:new R};break}return s[t.id]=e,e}}}function X0(){const s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new lt};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new lt};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new lt,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[t.id]=e,e}}}let q0=0;function Y0(s,t){return(t.castShadow?2:0)-(s.castShadow?2:0)+(t.map?1:0)-(s.map?1:0)}function K0(s){const t=new W0,e=X0(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new R);const n=new R,r=new se,a=new se;function o(c){let h=0,u=0,d=0;for(let S=0;S<9;S++)i.probe[S].set(0,0,0);let p=0,g=0,v=0,m=0,f=0,M=0,y=0,x=0,I=0,A=0,C=0;c.sort(Y0);for(let S=0,_=c.length;S<_;S++){const L=c[S],O=L.color,F=L.intensity,G=L.distance,q=L.shadow&&L.shadow.map?L.shadow.map.texture:null;if(L.isAmbientLight)h+=O.r*F,u+=O.g*F,d+=O.b*F;else if(L.isLightProbe){for(let W=0;W<9;W++)i.probe[W].addScaledVector(L.sh.coefficients[W],F);C++}else if(L.isDirectionalLight){const W=t.get(L);if(W.color.copy(L.color).multiplyScalar(L.intensity),L.castShadow){const Z=L.shadow,V=e.get(L);V.shadowIntensity=Z.intensity,V.shadowBias=Z.bias,V.shadowNormalBias=Z.normalBias,V.shadowRadius=Z.radius,V.shadowMapSize=Z.mapSize,i.directionalShadow[p]=V,i.directionalShadowMap[p]=q,i.directionalShadowMatrix[p]=L.shadow.matrix,M++}i.directional[p]=W,p++}else if(L.isSpotLight){const W=t.get(L);W.position.setFromMatrixPosition(L.matrixWorld),W.color.copy(O).multiplyScalar(F),W.distance=G,W.coneCos=Math.cos(L.angle),W.penumbraCos=Math.cos(L.angle*(1-L.penumbra)),W.decay=L.decay,i.spot[v]=W;const Z=L.shadow;if(L.map&&(i.spotLightMap[I]=L.map,I++,Z.updateMatrices(L),L.castShadow&&A++),i.spotLightMatrix[v]=Z.matrix,L.castShadow){const V=e.get(L);V.shadowIntensity=Z.intensity,V.shadowBias=Z.bias,V.shadowNormalBias=Z.normalBias,V.shadowRadius=Z.radius,V.shadowMapSize=Z.mapSize,i.spotShadow[v]=V,i.spotShadowMap[v]=q,x++}v++}else if(L.isRectAreaLight){const W=t.get(L);W.color.copy(O).multiplyScalar(F),W.halfWidth.set(L.width*.5,0,0),W.halfHeight.set(0,L.height*.5,0),i.rectArea[m]=W,m++}else if(L.isPointLight){const W=t.get(L);if(W.color.copy(L.color).multiplyScalar(L.intensity),W.distance=L.distance,W.decay=L.decay,L.castShadow){const Z=L.shadow,V=e.get(L);V.shadowIntensity=Z.intensity,V.shadowBias=Z.bias,V.shadowNormalBias=Z.normalBias,V.shadowRadius=Z.radius,V.shadowMapSize=Z.mapSize,V.shadowCameraNear=Z.camera.near,V.shadowCameraFar=Z.camera.far,i.pointShadow[g]=V,i.pointShadowMap[g]=q,i.pointShadowMatrix[g]=L.shadow.matrix,y++}i.point[g]=W,g++}else if(L.isHemisphereLight){const W=t.get(L);W.skyColor.copy(L.color).multiplyScalar(F),W.groundColor.copy(L.groundColor).multiplyScalar(F),i.hemi[f]=W,f++}}m>0&&(s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=dt.LTC_FLOAT_1,i.rectAreaLTC2=dt.LTC_FLOAT_2):(i.rectAreaLTC1=dt.LTC_HALF_1,i.rectAreaLTC2=dt.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=u,i.ambient[2]=d;const P=i.hash;(P.directionalLength!==p||P.pointLength!==g||P.spotLength!==v||P.rectAreaLength!==m||P.hemiLength!==f||P.numDirectionalShadows!==M||P.numPointShadows!==y||P.numSpotShadows!==x||P.numSpotMaps!==I||P.numLightProbes!==C)&&(i.directional.length=p,i.spot.length=v,i.rectArea.length=m,i.point.length=g,i.hemi.length=f,i.directionalShadow.length=M,i.directionalShadowMap.length=M,i.pointShadow.length=y,i.pointShadowMap.length=y,i.spotShadow.length=x,i.spotShadowMap.length=x,i.directionalShadowMatrix.length=M,i.pointShadowMatrix.length=y,i.spotLightMatrix.length=x+I-A,i.spotLightMap.length=I,i.numSpotLightShadowsWithMaps=A,i.numLightProbes=C,P.directionalLength=p,P.pointLength=g,P.spotLength=v,P.rectAreaLength=m,P.hemiLength=f,P.numDirectionalShadows=M,P.numPointShadows=y,P.numSpotShadows=x,P.numSpotMaps=I,P.numLightProbes=C,i.version=q0++)}function l(c,h){let u=0,d=0,p=0,g=0,v=0;const m=h.matrixWorldInverse;for(let f=0,M=c.length;f<M;f++){const y=c[f];if(y.isDirectionalLight){const x=i.directional[u];x.direction.setFromMatrixPosition(y.matrixWorld),n.setFromMatrixPosition(y.target.matrixWorld),x.direction.sub(n),x.direction.transformDirection(m),u++}else if(y.isSpotLight){const x=i.spot[p];x.position.setFromMatrixPosition(y.matrixWorld),x.position.applyMatrix4(m),x.direction.setFromMatrixPosition(y.matrixWorld),n.setFromMatrixPosition(y.target.matrixWorld),x.direction.sub(n),x.direction.transformDirection(m),p++}else if(y.isRectAreaLight){const x=i.rectArea[g];x.position.setFromMatrixPosition(y.matrixWorld),x.position.applyMatrix4(m),a.identity(),r.copy(y.matrixWorld),r.premultiply(m),a.extractRotation(r),x.halfWidth.set(y.width*.5,0,0),x.halfHeight.set(0,y.height*.5,0),x.halfWidth.applyMatrix4(a),x.halfHeight.applyMatrix4(a),g++}else if(y.isPointLight){const x=i.point[d];x.position.setFromMatrixPosition(y.matrixWorld),x.position.applyMatrix4(m),d++}else if(y.isHemisphereLight){const x=i.hemi[v];x.direction.setFromMatrixPosition(y.matrixWorld),x.direction.transformDirection(m),v++}}}return{setup:o,setupView:l,state:i}}function Ql(s){const t=new K0(s),e=[],i=[];function n(h){c.camera=h,e.length=0,i.length=0}function r(h){e.push(h)}function a(h){i.push(h)}function o(){t.setup(e)}function l(h){t.setupView(e,h)}const c={lightsArray:e,shadowsArray:i,camera:null,lights:t,transmissionRenderTarget:{}};return{init:n,state:c,setupLights:o,setupLightsView:l,pushLight:r,pushShadow:a}}function $0(s){let t=new WeakMap;function e(n,r=0){const a=t.get(n);let o;return a===void 0?(o=new Ql(s),t.set(n,[o])):r>=a.length?(o=new Ql(s),a.push(o)):o=a[r],o}function i(){t=new WeakMap}return{get:e,dispose:i}}class j0 extends Bi{static get type(){return"MeshDepthMaterial"}constructor(t){super(),this.isMeshDepthMaterial=!0,this.depthPacking=Cu,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class Z0 extends Bi{static get type(){return"MeshDistanceMaterial"}constructor(t){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const J0=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Q0=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function tg(s,t,e){let i=new zo;const n=new lt,r=new lt,a=new ae,o=new j0({depthPacking:Lu}),l=new Z0,c={},h=e.maxTextureSize,u={[Oi]:De,[De]:Oi,[Re]:Re},d=new Si({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new lt},radius:{value:4}},vertexShader:J0,fragmentShader:Q0}),p=d.clone();p.defines.HORIZONTAL_PASS=1;const g=new ye;g.setAttribute("position",new Ae(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const v=new gt(g,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Nc;let f=this.type;this.render=function(A,C,P){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||A.length===0)return;const S=s.getRenderTarget(),_=s.getActiveCubeFace(),L=s.getActiveMipmapLevel(),O=s.state;O.setBlending(Ni),O.buffers.color.setClear(1,1,1,1),O.buffers.depth.setTest(!0),O.setScissorTest(!1);const F=f!==xi&&this.type===xi,G=f===xi&&this.type!==xi;for(let q=0,W=A.length;q<W;q++){const Z=A[q],V=Z.shadow;if(V===void 0){console.warn("THREE.WebGLShadowMap:",Z,"has no shadow.");continue}if(V.autoUpdate===!1&&V.needsUpdate===!1)continue;n.copy(V.mapSize);const ct=V.getFrameExtents();if(n.multiply(ct),r.copy(V.mapSize),(n.x>h||n.y>h)&&(n.x>h&&(r.x=Math.floor(h/ct.x),n.x=r.x*ct.x,V.mapSize.x=r.x),n.y>h&&(r.y=Math.floor(h/ct.y),n.y=r.y*ct.y,V.mapSize.y=r.y)),V.map===null||F===!0||G===!0){const Mt=this.type!==xi?{minFilter:Oe,magFilter:Oe}:{};V.map!==null&&V.map.dispose(),V.map=new rn(n.x,n.y,Mt),V.map.texture.name=Z.name+".shadowMap",V.camera.updateProjectionMatrix()}s.setRenderTarget(V.map),s.clear();const ht=V.getViewportCount();for(let Mt=0;Mt<ht;Mt++){const zt=V.getViewport(Mt);a.set(r.x*zt.x,r.y*zt.y,r.x*zt.z,r.y*zt.w),O.viewport(a),V.updateMatrices(Z,Mt),i=V.getFrustum(),x(C,P,V.camera,Z,this.type)}V.isPointLightShadow!==!0&&this.type===xi&&M(V,P),V.needsUpdate=!1}f=this.type,m.needsUpdate=!1,s.setRenderTarget(S,_,L)};function M(A,C){const P=t.update(v);d.defines.VSM_SAMPLES!==A.blurSamples&&(d.defines.VSM_SAMPLES=A.blurSamples,p.defines.VSM_SAMPLES=A.blurSamples,d.needsUpdate=!0,p.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new rn(n.x,n.y)),d.uniforms.shadow_pass.value=A.map.texture,d.uniforms.resolution.value=A.mapSize,d.uniforms.radius.value=A.radius,s.setRenderTarget(A.mapPass),s.clear(),s.renderBufferDirect(C,null,P,d,v,null),p.uniforms.shadow_pass.value=A.mapPass.texture,p.uniforms.resolution.value=A.mapSize,p.uniforms.radius.value=A.radius,s.setRenderTarget(A.map),s.clear(),s.renderBufferDirect(C,null,P,p,v,null)}function y(A,C,P,S){let _=null;const L=P.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(L!==void 0)_=L;else if(_=P.isPointLight===!0?l:o,s.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0){const O=_.uuid,F=C.uuid;let G=c[O];G===void 0&&(G={},c[O]=G);let q=G[F];q===void 0&&(q=_.clone(),G[F]=q,C.addEventListener("dispose",I)),_=q}if(_.visible=C.visible,_.wireframe=C.wireframe,S===xi?_.side=C.shadowSide!==null?C.shadowSide:C.side:_.side=C.shadowSide!==null?C.shadowSide:u[C.side],_.alphaMap=C.alphaMap,_.alphaTest=C.alphaTest,_.map=C.map,_.clipShadows=C.clipShadows,_.clippingPlanes=C.clippingPlanes,_.clipIntersection=C.clipIntersection,_.displacementMap=C.displacementMap,_.displacementScale=C.displacementScale,_.displacementBias=C.displacementBias,_.wireframeLinewidth=C.wireframeLinewidth,_.linewidth=C.linewidth,P.isPointLight===!0&&_.isMeshDistanceMaterial===!0){const O=s.properties.get(_);O.light=P}return _}function x(A,C,P,S,_){if(A.visible===!1)return;if(A.layers.test(C.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&_===xi)&&(!A.frustumCulled||i.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(P.matrixWorldInverse,A.matrixWorld);const F=t.update(A),G=A.material;if(Array.isArray(G)){const q=F.groups;for(let W=0,Z=q.length;W<Z;W++){const V=q[W],ct=G[V.materialIndex];if(ct&&ct.visible){const ht=y(A,ct,S,_);A.onBeforeShadow(s,A,C,P,F,ht,V),s.renderBufferDirect(P,null,F,ht,A,V),A.onAfterShadow(s,A,C,P,F,ht,V)}}}else if(G.visible){const q=y(A,G,S,_);A.onBeforeShadow(s,A,C,P,F,q,null),s.renderBufferDirect(P,null,F,q,A,null),A.onAfterShadow(s,A,C,P,F,q,null)}}const O=A.children;for(let F=0,G=O.length;F<G;F++)x(O[F],C,P,S,_)}function I(A){A.target.removeEventListener("dispose",I);for(const P in c){const S=c[P],_=A.target.uuid;_ in S&&(S[_].dispose(),delete S[_])}}}const eg={[Da]:Ua,[Na]:Fa,[ka]:za,[Hn]:Oa,[Ua]:Da,[Fa]:Na,[za]:ka,[Oa]:Hn};function ig(s,t){function e(){let D=!1;const pt=new ae;let X=null;const J=new ae(0,0,0,0);return{setMask:function(_t){X!==_t&&!D&&(s.colorMask(_t,_t,_t,_t),X=_t)},setLocked:function(_t){D=_t},setClear:function(_t,vt,Ht,ge,Ce){Ce===!0&&(_t*=ge,vt*=ge,Ht*=ge),pt.set(_t,vt,Ht,ge),J.equals(pt)===!1&&(s.clearColor(_t,vt,Ht,ge),J.copy(pt))},reset:function(){D=!1,X=null,J.set(-1,0,0,0)}}}function i(){let D=!1,pt=!1,X=null,J=null,_t=null;return{setReversed:function(vt){if(pt!==vt){const Ht=t.get("EXT_clip_control");pt?Ht.clipControlEXT(Ht.LOWER_LEFT_EXT,Ht.ZERO_TO_ONE_EXT):Ht.clipControlEXT(Ht.LOWER_LEFT_EXT,Ht.NEGATIVE_ONE_TO_ONE_EXT);const ge=_t;_t=null,this.setClear(ge)}pt=vt},getReversed:function(){return pt},setTest:function(vt){vt?at(s.DEPTH_TEST):Lt(s.DEPTH_TEST)},setMask:function(vt){X!==vt&&!D&&(s.depthMask(vt),X=vt)},setFunc:function(vt){if(pt&&(vt=eg[vt]),J!==vt){switch(vt){case Da:s.depthFunc(s.NEVER);break;case Ua:s.depthFunc(s.ALWAYS);break;case Na:s.depthFunc(s.LESS);break;case Hn:s.depthFunc(s.LEQUAL);break;case ka:s.depthFunc(s.EQUAL);break;case Oa:s.depthFunc(s.GEQUAL);break;case Fa:s.depthFunc(s.GREATER);break;case za:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}J=vt}},setLocked:function(vt){D=vt},setClear:function(vt){_t!==vt&&(pt&&(vt=1-vt),s.clearDepth(vt),_t=vt)},reset:function(){D=!1,X=null,J=null,_t=null,pt=!1}}}function n(){let D=!1,pt=null,X=null,J=null,_t=null,vt=null,Ht=null,ge=null,Ce=null;return{setTest:function(ie){D||(ie?at(s.STENCIL_TEST):Lt(s.STENCIL_TEST))},setMask:function(ie){pt!==ie&&!D&&(s.stencilMask(ie),pt=ie)},setFunc:function(ie,Ze,ui){(X!==ie||J!==Ze||_t!==ui)&&(s.stencilFunc(ie,Ze,ui),X=ie,J=Ze,_t=ui)},setOp:function(ie,Ze,ui){(vt!==ie||Ht!==Ze||ge!==ui)&&(s.stencilOp(ie,Ze,ui),vt=ie,Ht=Ze,ge=ui)},setLocked:function(ie){D=ie},setClear:function(ie){Ce!==ie&&(s.clearStencil(ie),Ce=ie)},reset:function(){D=!1,pt=null,X=null,J=null,_t=null,vt=null,Ht=null,ge=null,Ce=null}}}const r=new e,a=new i,o=new n,l=new WeakMap,c=new WeakMap;let h={},u={},d=new WeakMap,p=[],g=null,v=!1,m=null,f=null,M=null,y=null,x=null,I=null,A=null,C=new Ut(0,0,0),P=0,S=!1,_=null,L=null,O=null,F=null,G=null;const q=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let W=!1,Z=0;const V=s.getParameter(s.VERSION);V.indexOf("WebGL")!==-1?(Z=parseFloat(/^WebGL (\d)/.exec(V)[1]),W=Z>=1):V.indexOf("OpenGL ES")!==-1&&(Z=parseFloat(/^OpenGL ES (\d)/.exec(V)[1]),W=Z>=2);let ct=null,ht={};const Mt=s.getParameter(s.SCISSOR_BOX),zt=s.getParameter(s.VIEWPORT),jt=new ae().fromArray(Mt),Y=new ae().fromArray(zt);function nt(D,pt,X,J){const _t=new Uint8Array(4),vt=s.createTexture();s.bindTexture(D,vt),s.texParameteri(D,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(D,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let Ht=0;Ht<X;Ht++)D===s.TEXTURE_3D||D===s.TEXTURE_2D_ARRAY?s.texImage3D(pt,0,s.RGBA,1,1,J,0,s.RGBA,s.UNSIGNED_BYTE,_t):s.texImage2D(pt+Ht,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,_t);return vt}const St={};St[s.TEXTURE_2D]=nt(s.TEXTURE_2D,s.TEXTURE_2D,1),St[s.TEXTURE_CUBE_MAP]=nt(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),St[s.TEXTURE_2D_ARRAY]=nt(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),St[s.TEXTURE_3D]=nt(s.TEXTURE_3D,s.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),at(s.DEPTH_TEST),a.setFunc(Hn),j(!1),ut(nl),at(s.CULL_FACE),T(Ni);function at(D){h[D]!==!0&&(s.enable(D),h[D]=!0)}function Lt(D){h[D]!==!1&&(s.disable(D),h[D]=!1)}function kt(D,pt){return u[D]!==pt?(s.bindFramebuffer(D,pt),u[D]=pt,D===s.DRAW_FRAMEBUFFER&&(u[s.FRAMEBUFFER]=pt),D===s.FRAMEBUFFER&&(u[s.DRAW_FRAMEBUFFER]=pt),!0):!1}function Nt(D,pt){let X=p,J=!1;if(D){X=d.get(pt),X===void 0&&(X=[],d.set(pt,X));const _t=D.textures;if(X.length!==_t.length||X[0]!==s.COLOR_ATTACHMENT0){for(let vt=0,Ht=_t.length;vt<Ht;vt++)X[vt]=s.COLOR_ATTACHMENT0+vt;X.length=_t.length,J=!0}}else X[0]!==s.BACK&&(X[0]=s.BACK,J=!0);J&&s.drawBuffers(X)}function qt(D){return g!==D?(s.useProgram(D),g=D,!0):!1}const Q={[Ji]:s.FUNC_ADD,[nu]:s.FUNC_SUBTRACT,[su]:s.FUNC_REVERSE_SUBTRACT};Q[ru]=s.MIN,Q[au]=s.MAX;const st={[ou]:s.ZERO,[lu]:s.ONE,[cu]:s.SRC_COLOR,[Pa]:s.SRC_ALPHA,[mu]:s.SRC_ALPHA_SATURATE,[fu]:s.DST_COLOR,[uu]:s.DST_ALPHA,[hu]:s.ONE_MINUS_SRC_COLOR,[Ia]:s.ONE_MINUS_SRC_ALPHA,[pu]:s.ONE_MINUS_DST_COLOR,[du]:s.ONE_MINUS_DST_ALPHA,[gu]:s.CONSTANT_COLOR,[vu]:s.ONE_MINUS_CONSTANT_COLOR,[xu]:s.CONSTANT_ALPHA,[_u]:s.ONE_MINUS_CONSTANT_ALPHA};function T(D,pt,X,J,_t,vt,Ht,ge,Ce,ie){if(D===Ni){v===!0&&(Lt(s.BLEND),v=!1);return}if(v===!1&&(at(s.BLEND),v=!0),D!==iu){if(D!==m||ie!==S){if((f!==Ji||x!==Ji)&&(s.blendEquation(s.FUNC_ADD),f=Ji,x=Ji),ie)switch(D){case Nn:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case $e:s.blendFunc(s.ONE,s.ONE);break;case sl:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case rl:s.blendFuncSeparate(s.ZERO,s.SRC_COLOR,s.ZERO,s.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}else switch(D){case Nn:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case $e:s.blendFunc(s.SRC_ALPHA,s.ONE);break;case sl:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case rl:s.blendFunc(s.ZERO,s.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}M=null,y=null,I=null,A=null,C.set(0,0,0),P=0,m=D,S=ie}return}_t=_t||pt,vt=vt||X,Ht=Ht||J,(pt!==f||_t!==x)&&(s.blendEquationSeparate(Q[pt],Q[_t]),f=pt,x=_t),(X!==M||J!==y||vt!==I||Ht!==A)&&(s.blendFuncSeparate(st[X],st[J],st[vt],st[Ht]),M=X,y=J,I=vt,A=Ht),(ge.equals(C)===!1||Ce!==P)&&(s.blendColor(ge.r,ge.g,ge.b,Ce),C.copy(ge),P=Ce),m=D,S=!1}function et(D,pt){D.side===Re?Lt(s.CULL_FACE):at(s.CULL_FACE);let X=D.side===De;pt&&(X=!X),j(X),D.blending===Nn&&D.transparent===!1?T(Ni):T(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),a.setFunc(D.depthFunc),a.setTest(D.depthTest),a.setMask(D.depthWrite),r.setMask(D.colorWrite);const J=D.stencilWrite;o.setTest(J),J&&(o.setMask(D.stencilWriteMask),o.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),o.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),Dt(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?at(s.SAMPLE_ALPHA_TO_COVERAGE):Lt(s.SAMPLE_ALPHA_TO_COVERAGE)}function j(D){_!==D&&(D?s.frontFace(s.CW):s.frontFace(s.CCW),_=D)}function ut(D){D!==tu?(at(s.CULL_FACE),D!==L&&(D===nl?s.cullFace(s.BACK):D===eu?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):Lt(s.CULL_FACE),L=D}function ot(D){D!==O&&(W&&s.lineWidth(D),O=D)}function Dt(D,pt,X){D?(at(s.POLYGON_OFFSET_FILL),(F!==pt||G!==X)&&(s.polygonOffset(pt,X),F=pt,G=X)):Lt(s.POLYGON_OFFSET_FILL)}function mt(D){D?at(s.SCISSOR_TEST):Lt(s.SCISSOR_TEST)}function E(D){D===void 0&&(D=s.TEXTURE0+q-1),ct!==D&&(s.activeTexture(D),ct=D)}function b(D,pt,X){X===void 0&&(ct===null?X=s.TEXTURE0+q-1:X=ct);let J=ht[X];J===void 0&&(J={type:void 0,texture:void 0},ht[X]=J),(J.type!==D||J.texture!==pt)&&(ct!==X&&(s.activeTexture(X),ct=X),s.bindTexture(D,pt||St[D]),J.type=D,J.texture=pt)}function z(){const D=ht[ct];D!==void 0&&D.type!==void 0&&(s.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function K(){try{s.compressedTexImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function tt(){try{s.compressedTexImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function $(){try{s.texSubImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Et(){try{s.texSubImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function ft(){try{s.compressedTexSubImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function yt(){try{s.compressedTexSubImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Yt(){try{s.texStorage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function it(){try{s.texStorage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function bt(){try{s.texImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Ot(){try{s.texImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Ft(D){jt.equals(D)===!1&&(s.scissor(D.x,D.y,D.z,D.w),jt.copy(D))}function wt(D){Y.equals(D)===!1&&(s.viewport(D.x,D.y,D.z,D.w),Y.copy(D))}function Kt(D,pt){let X=c.get(pt);X===void 0&&(X=new WeakMap,c.set(pt,X));let J=X.get(D);J===void 0&&(J=s.getUniformBlockIndex(pt,D.name),X.set(D,J))}function Wt(D,pt){const J=c.get(pt).get(D);l.get(pt)!==J&&(s.uniformBlockBinding(pt,J,D.__bindingPointIndex),l.set(pt,J))}function oe(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),a.setReversed(!1),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),h={},ct=null,ht={},u={},d=new WeakMap,p=[],g=null,v=!1,m=null,f=null,M=null,y=null,x=null,I=null,A=null,C=new Ut(0,0,0),P=0,S=!1,_=null,L=null,O=null,F=null,G=null,jt.set(0,0,s.canvas.width,s.canvas.height),Y.set(0,0,s.canvas.width,s.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:at,disable:Lt,bindFramebuffer:kt,drawBuffers:Nt,useProgram:qt,setBlending:T,setMaterial:et,setFlipSided:j,setCullFace:ut,setLineWidth:ot,setPolygonOffset:Dt,setScissorTest:mt,activeTexture:E,bindTexture:b,unbindTexture:z,compressedTexImage2D:K,compressedTexImage3D:tt,texImage2D:bt,texImage3D:Ot,updateUBOMapping:Kt,uniformBlockBinding:Wt,texStorage2D:Yt,texStorage3D:it,texSubImage2D:$,texSubImage3D:Et,compressedTexSubImage2D:ft,compressedTexSubImage3D:yt,scissor:Ft,viewport:wt,reset:oe}}function tc(s,t,e,i){const n=ng(i);switch(e){case Vc:return s*t;case Xc:return s*t;case qc:return s*t*2;case Io:return s*t/n.components*n.byteLength;case Do:return s*t/n.components*n.byteLength;case Yc:return s*t*2/n.components*n.byteLength;case Uo:return s*t*2/n.components*n.byteLength;case Wc:return s*t*3/n.components*n.byteLength;case Ke:return s*t*4/n.components*n.byteLength;case No:return s*t*4/n.components*n.byteLength;case gr:case vr:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*8;case xr:case _r:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*16;case Wa:case qa:return Math.max(s,16)*Math.max(t,8)/4;case Va:case Xa:return Math.max(s,8)*Math.max(t,8)/2;case Ya:case Ka:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*8;case $a:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*16;case ja:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*16;case Za:return Math.floor((s+4)/5)*Math.floor((t+3)/4)*16;case Ja:return Math.floor((s+4)/5)*Math.floor((t+4)/5)*16;case Qa:return Math.floor((s+5)/6)*Math.floor((t+4)/5)*16;case to:return Math.floor((s+5)/6)*Math.floor((t+5)/6)*16;case eo:return Math.floor((s+7)/8)*Math.floor((t+4)/5)*16;case io:return Math.floor((s+7)/8)*Math.floor((t+5)/6)*16;case no:return Math.floor((s+7)/8)*Math.floor((t+7)/8)*16;case so:return Math.floor((s+9)/10)*Math.floor((t+4)/5)*16;case ro:return Math.floor((s+9)/10)*Math.floor((t+5)/6)*16;case ao:return Math.floor((s+9)/10)*Math.floor((t+7)/8)*16;case oo:return Math.floor((s+9)/10)*Math.floor((t+9)/10)*16;case lo:return Math.floor((s+11)/12)*Math.floor((t+9)/10)*16;case co:return Math.floor((s+11)/12)*Math.floor((t+11)/12)*16;case yr:case ho:case uo:return Math.ceil(s/4)*Math.ceil(t/4)*16;case Kc:case fo:return Math.ceil(s/4)*Math.ceil(t/4)*8;case po:case mo:return Math.ceil(s/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function ng(s){switch(s){case Mi:case Bc:return{byteLength:1,components:1};case Ss:case Hc:case Is:return{byteLength:2,components:1};case Lo:case Po:return{byteLength:2,components:4};case sn:case Co:case li:return{byteLength:4,components:1};case Gc:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${s}.`)}function sg(s,t,e,i,n,r,a){const o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new lt,h=new WeakMap;let u;const d=new WeakMap;let p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(E,b){return p?new OffscreenCanvas(E,b):Er("canvas")}function v(E,b,z){let K=1;const tt=mt(E);if((tt.width>z||tt.height>z)&&(K=z/Math.max(tt.width,tt.height)),K<1)if(typeof HTMLImageElement<"u"&&E instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&E instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&E instanceof ImageBitmap||typeof VideoFrame<"u"&&E instanceof VideoFrame){const $=Math.floor(K*tt.width),Et=Math.floor(K*tt.height);u===void 0&&(u=g($,Et));const ft=b?g($,Et):u;return ft.width=$,ft.height=Et,ft.getContext("2d").drawImage(E,0,0,$,Et),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+tt.width+"x"+tt.height+") to ("+$+"x"+Et+")."),ft}else return"data"in E&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+tt.width+"x"+tt.height+")."),E;return E}function m(E){return E.generateMipmaps}function f(E){s.generateMipmap(E)}function M(E){return E.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:E.isWebGL3DRenderTarget?s.TEXTURE_3D:E.isWebGLArrayRenderTarget||E.isCompressedArrayTexture?s.TEXTURE_2D_ARRAY:s.TEXTURE_2D}function y(E,b,z,K,tt=!1){if(E!==null){if(s[E]!==void 0)return s[E];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+E+"'")}let $=b;if(b===s.RED&&(z===s.FLOAT&&($=s.R32F),z===s.HALF_FLOAT&&($=s.R16F),z===s.UNSIGNED_BYTE&&($=s.R8)),b===s.RED_INTEGER&&(z===s.UNSIGNED_BYTE&&($=s.R8UI),z===s.UNSIGNED_SHORT&&($=s.R16UI),z===s.UNSIGNED_INT&&($=s.R32UI),z===s.BYTE&&($=s.R8I),z===s.SHORT&&($=s.R16I),z===s.INT&&($=s.R32I)),b===s.RG&&(z===s.FLOAT&&($=s.RG32F),z===s.HALF_FLOAT&&($=s.RG16F),z===s.UNSIGNED_BYTE&&($=s.RG8)),b===s.RG_INTEGER&&(z===s.UNSIGNED_BYTE&&($=s.RG8UI),z===s.UNSIGNED_SHORT&&($=s.RG16UI),z===s.UNSIGNED_INT&&($=s.RG32UI),z===s.BYTE&&($=s.RG8I),z===s.SHORT&&($=s.RG16I),z===s.INT&&($=s.RG32I)),b===s.RGB_INTEGER&&(z===s.UNSIGNED_BYTE&&($=s.RGB8UI),z===s.UNSIGNED_SHORT&&($=s.RGB16UI),z===s.UNSIGNED_INT&&($=s.RGB32UI),z===s.BYTE&&($=s.RGB8I),z===s.SHORT&&($=s.RGB16I),z===s.INT&&($=s.RGB32I)),b===s.RGBA_INTEGER&&(z===s.UNSIGNED_BYTE&&($=s.RGBA8UI),z===s.UNSIGNED_SHORT&&($=s.RGBA16UI),z===s.UNSIGNED_INT&&($=s.RGBA32UI),z===s.BYTE&&($=s.RGBA8I),z===s.SHORT&&($=s.RGBA16I),z===s.INT&&($=s.RGBA32I)),b===s.RGB&&z===s.UNSIGNED_INT_5_9_9_9_REV&&($=s.RGB9_E5),b===s.RGBA){const Et=tt?Ir:Jt.getTransfer(K);z===s.FLOAT&&($=s.RGBA32F),z===s.HALF_FLOAT&&($=s.RGBA16F),z===s.UNSIGNED_BYTE&&($=Et===re?s.SRGB8_ALPHA8:s.RGBA8),z===s.UNSIGNED_SHORT_4_4_4_4&&($=s.RGBA4),z===s.UNSIGNED_SHORT_5_5_5_1&&($=s.RGB5_A1)}return($===s.R16F||$===s.R32F||$===s.RG16F||$===s.RG32F||$===s.RGBA16F||$===s.RGBA32F)&&t.get("EXT_color_buffer_float"),$}function x(E,b){let z;return E?b===null||b===sn||b===Wn?z=s.DEPTH24_STENCIL8:b===li?z=s.DEPTH32F_STENCIL8:b===Ss&&(z=s.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):b===null||b===sn||b===Wn?z=s.DEPTH_COMPONENT24:b===li?z=s.DEPTH_COMPONENT32F:b===Ss&&(z=s.DEPTH_COMPONENT16),z}function I(E,b){return m(E)===!0||E.isFramebufferTexture&&E.minFilter!==Oe&&E.minFilter!==oi?Math.log2(Math.max(b.width,b.height))+1:E.mipmaps!==void 0&&E.mipmaps.length>0?E.mipmaps.length:E.isCompressedTexture&&Array.isArray(E.image)?b.mipmaps.length:1}function A(E){const b=E.target;b.removeEventListener("dispose",A),P(b),b.isVideoTexture&&h.delete(b)}function C(E){const b=E.target;b.removeEventListener("dispose",C),_(b)}function P(E){const b=i.get(E);if(b.__webglInit===void 0)return;const z=E.source,K=d.get(z);if(K){const tt=K[b.__cacheKey];tt.usedTimes--,tt.usedTimes===0&&S(E),Object.keys(K).length===0&&d.delete(z)}i.remove(E)}function S(E){const b=i.get(E);s.deleteTexture(b.__webglTexture);const z=E.source,K=d.get(z);delete K[b.__cacheKey],a.memory.textures--}function _(E){const b=i.get(E);if(E.depthTexture&&(E.depthTexture.dispose(),i.remove(E.depthTexture)),E.isWebGLCubeRenderTarget)for(let K=0;K<6;K++){if(Array.isArray(b.__webglFramebuffer[K]))for(let tt=0;tt<b.__webglFramebuffer[K].length;tt++)s.deleteFramebuffer(b.__webglFramebuffer[K][tt]);else s.deleteFramebuffer(b.__webglFramebuffer[K]);b.__webglDepthbuffer&&s.deleteRenderbuffer(b.__webglDepthbuffer[K])}else{if(Array.isArray(b.__webglFramebuffer))for(let K=0;K<b.__webglFramebuffer.length;K++)s.deleteFramebuffer(b.__webglFramebuffer[K]);else s.deleteFramebuffer(b.__webglFramebuffer);if(b.__webglDepthbuffer&&s.deleteRenderbuffer(b.__webglDepthbuffer),b.__webglMultisampledFramebuffer&&s.deleteFramebuffer(b.__webglMultisampledFramebuffer),b.__webglColorRenderbuffer)for(let K=0;K<b.__webglColorRenderbuffer.length;K++)b.__webglColorRenderbuffer[K]&&s.deleteRenderbuffer(b.__webglColorRenderbuffer[K]);b.__webglDepthRenderbuffer&&s.deleteRenderbuffer(b.__webglDepthRenderbuffer)}const z=E.textures;for(let K=0,tt=z.length;K<tt;K++){const $=i.get(z[K]);$.__webglTexture&&(s.deleteTexture($.__webglTexture),a.memory.textures--),i.remove(z[K])}i.remove(E)}let L=0;function O(){L=0}function F(){const E=L;return E>=n.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+E+" texture units while this GPU supports only "+n.maxTextures),L+=1,E}function G(E){const b=[];return b.push(E.wrapS),b.push(E.wrapT),b.push(E.wrapR||0),b.push(E.magFilter),b.push(E.minFilter),b.push(E.anisotropy),b.push(E.internalFormat),b.push(E.format),b.push(E.type),b.push(E.generateMipmaps),b.push(E.premultiplyAlpha),b.push(E.flipY),b.push(E.unpackAlignment),b.push(E.colorSpace),b.join()}function q(E,b){const z=i.get(E);if(E.isVideoTexture&&ot(E),E.isRenderTargetTexture===!1&&E.version>0&&z.__version!==E.version){const K=E.image;if(K===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(K.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Y(z,E,b);return}}e.bindTexture(s.TEXTURE_2D,z.__webglTexture,s.TEXTURE0+b)}function W(E,b){const z=i.get(E);if(E.version>0&&z.__version!==E.version){Y(z,E,b);return}e.bindTexture(s.TEXTURE_2D_ARRAY,z.__webglTexture,s.TEXTURE0+b)}function Z(E,b){const z=i.get(E);if(E.version>0&&z.__version!==E.version){Y(z,E,b);return}e.bindTexture(s.TEXTURE_3D,z.__webglTexture,s.TEXTURE0+b)}function V(E,b){const z=i.get(E);if(E.version>0&&z.__version!==E.version){nt(z,E,b);return}e.bindTexture(s.TEXTURE_CUBE_MAP,z.__webglTexture,s.TEXTURE0+b)}const ct={[br]:s.REPEAT,[tn]:s.CLAMP_TO_EDGE,[Ga]:s.MIRRORED_REPEAT},ht={[Oe]:s.NEAREST,[Ru]:s.NEAREST_MIPMAP_NEAREST,[Os]:s.NEAREST_MIPMAP_LINEAR,[oi]:s.LINEAR,[qr]:s.LINEAR_MIPMAP_NEAREST,[en]:s.LINEAR_MIPMAP_LINEAR},Mt={[Iu]:s.NEVER,[Fu]:s.ALWAYS,[Du]:s.LESS,[$c]:s.LEQUAL,[Uu]:s.EQUAL,[Ou]:s.GEQUAL,[Nu]:s.GREATER,[ku]:s.NOTEQUAL};function zt(E,b){if(b.type===li&&t.has("OES_texture_float_linear")===!1&&(b.magFilter===oi||b.magFilter===qr||b.magFilter===Os||b.magFilter===en||b.minFilter===oi||b.minFilter===qr||b.minFilter===Os||b.minFilter===en)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),s.texParameteri(E,s.TEXTURE_WRAP_S,ct[b.wrapS]),s.texParameteri(E,s.TEXTURE_WRAP_T,ct[b.wrapT]),(E===s.TEXTURE_3D||E===s.TEXTURE_2D_ARRAY)&&s.texParameteri(E,s.TEXTURE_WRAP_R,ct[b.wrapR]),s.texParameteri(E,s.TEXTURE_MAG_FILTER,ht[b.magFilter]),s.texParameteri(E,s.TEXTURE_MIN_FILTER,ht[b.minFilter]),b.compareFunction&&(s.texParameteri(E,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(E,s.TEXTURE_COMPARE_FUNC,Mt[b.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(b.magFilter===Oe||b.minFilter!==Os&&b.minFilter!==en||b.type===li&&t.has("OES_texture_float_linear")===!1)return;if(b.anisotropy>1||i.get(b).__currentAnisotropy){const z=t.get("EXT_texture_filter_anisotropic");s.texParameterf(E,z.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(b.anisotropy,n.getMaxAnisotropy())),i.get(b).__currentAnisotropy=b.anisotropy}}}function jt(E,b){let z=!1;E.__webglInit===void 0&&(E.__webglInit=!0,b.addEventListener("dispose",A));const K=b.source;let tt=d.get(K);tt===void 0&&(tt={},d.set(K,tt));const $=G(b);if($!==E.__cacheKey){tt[$]===void 0&&(tt[$]={texture:s.createTexture(),usedTimes:0},a.memory.textures++,z=!0),tt[$].usedTimes++;const Et=tt[E.__cacheKey];Et!==void 0&&(tt[E.__cacheKey].usedTimes--,Et.usedTimes===0&&S(b)),E.__cacheKey=$,E.__webglTexture=tt[$].texture}return z}function Y(E,b,z){let K=s.TEXTURE_2D;(b.isDataArrayTexture||b.isCompressedArrayTexture)&&(K=s.TEXTURE_2D_ARRAY),b.isData3DTexture&&(K=s.TEXTURE_3D);const tt=jt(E,b),$=b.source;e.bindTexture(K,E.__webglTexture,s.TEXTURE0+z);const Et=i.get($);if($.version!==Et.__version||tt===!0){e.activeTexture(s.TEXTURE0+z);const ft=Jt.getPrimaries(Jt.workingColorSpace),yt=b.colorSpace===Ui?null:Jt.getPrimaries(b.colorSpace),Yt=b.colorSpace===Ui||ft===yt?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,b.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,b.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,b.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,Yt);let it=v(b.image,!1,n.maxTextureSize);it=Dt(b,it);const bt=r.convert(b.format,b.colorSpace),Ot=r.convert(b.type);let Ft=y(b.internalFormat,bt,Ot,b.colorSpace,b.isVideoTexture);zt(K,b);let wt;const Kt=b.mipmaps,Wt=b.isVideoTexture!==!0,oe=Et.__version===void 0||tt===!0,D=$.dataReady,pt=I(b,it);if(b.isDepthTexture)Ft=x(b.format===Xn,b.type),oe&&(Wt?e.texStorage2D(s.TEXTURE_2D,1,Ft,it.width,it.height):e.texImage2D(s.TEXTURE_2D,0,Ft,it.width,it.height,0,bt,Ot,null));else if(b.isDataTexture)if(Kt.length>0){Wt&&oe&&e.texStorage2D(s.TEXTURE_2D,pt,Ft,Kt[0].width,Kt[0].height);for(let X=0,J=Kt.length;X<J;X++)wt=Kt[X],Wt?D&&e.texSubImage2D(s.TEXTURE_2D,X,0,0,wt.width,wt.height,bt,Ot,wt.data):e.texImage2D(s.TEXTURE_2D,X,Ft,wt.width,wt.height,0,bt,Ot,wt.data);b.generateMipmaps=!1}else Wt?(oe&&e.texStorage2D(s.TEXTURE_2D,pt,Ft,it.width,it.height),D&&e.texSubImage2D(s.TEXTURE_2D,0,0,0,it.width,it.height,bt,Ot,it.data)):e.texImage2D(s.TEXTURE_2D,0,Ft,it.width,it.height,0,bt,Ot,it.data);else if(b.isCompressedTexture)if(b.isCompressedArrayTexture){Wt&&oe&&e.texStorage3D(s.TEXTURE_2D_ARRAY,pt,Ft,Kt[0].width,Kt[0].height,it.depth);for(let X=0,J=Kt.length;X<J;X++)if(wt=Kt[X],b.format!==Ke)if(bt!==null)if(Wt){if(D)if(b.layerUpdates.size>0){const _t=tc(wt.width,wt.height,b.format,b.type);for(const vt of b.layerUpdates){const Ht=wt.data.subarray(vt*_t/wt.data.BYTES_PER_ELEMENT,(vt+1)*_t/wt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,X,0,0,vt,wt.width,wt.height,1,bt,Ht)}b.clearLayerUpdates()}else e.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,X,0,0,0,wt.width,wt.height,it.depth,bt,wt.data)}else e.compressedTexImage3D(s.TEXTURE_2D_ARRAY,X,Ft,wt.width,wt.height,it.depth,0,wt.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Wt?D&&e.texSubImage3D(s.TEXTURE_2D_ARRAY,X,0,0,0,wt.width,wt.height,it.depth,bt,Ot,wt.data):e.texImage3D(s.TEXTURE_2D_ARRAY,X,Ft,wt.width,wt.height,it.depth,0,bt,Ot,wt.data)}else{Wt&&oe&&e.texStorage2D(s.TEXTURE_2D,pt,Ft,Kt[0].width,Kt[0].height);for(let X=0,J=Kt.length;X<J;X++)wt=Kt[X],b.format!==Ke?bt!==null?Wt?D&&e.compressedTexSubImage2D(s.TEXTURE_2D,X,0,0,wt.width,wt.height,bt,wt.data):e.compressedTexImage2D(s.TEXTURE_2D,X,Ft,wt.width,wt.height,0,wt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Wt?D&&e.texSubImage2D(s.TEXTURE_2D,X,0,0,wt.width,wt.height,bt,Ot,wt.data):e.texImage2D(s.TEXTURE_2D,X,Ft,wt.width,wt.height,0,bt,Ot,wt.data)}else if(b.isDataArrayTexture)if(Wt){if(oe&&e.texStorage3D(s.TEXTURE_2D_ARRAY,pt,Ft,it.width,it.height,it.depth),D)if(b.layerUpdates.size>0){const X=tc(it.width,it.height,b.format,b.type);for(const J of b.layerUpdates){const _t=it.data.subarray(J*X/it.data.BYTES_PER_ELEMENT,(J+1)*X/it.data.BYTES_PER_ELEMENT);e.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,J,it.width,it.height,1,bt,Ot,_t)}b.clearLayerUpdates()}else e.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,it.width,it.height,it.depth,bt,Ot,it.data)}else e.texImage3D(s.TEXTURE_2D_ARRAY,0,Ft,it.width,it.height,it.depth,0,bt,Ot,it.data);else if(b.isData3DTexture)Wt?(oe&&e.texStorage3D(s.TEXTURE_3D,pt,Ft,it.width,it.height,it.depth),D&&e.texSubImage3D(s.TEXTURE_3D,0,0,0,0,it.width,it.height,it.depth,bt,Ot,it.data)):e.texImage3D(s.TEXTURE_3D,0,Ft,it.width,it.height,it.depth,0,bt,Ot,it.data);else if(b.isFramebufferTexture){if(oe)if(Wt)e.texStorage2D(s.TEXTURE_2D,pt,Ft,it.width,it.height);else{let X=it.width,J=it.height;for(let _t=0;_t<pt;_t++)e.texImage2D(s.TEXTURE_2D,_t,Ft,X,J,0,bt,Ot,null),X>>=1,J>>=1}}else if(Kt.length>0){if(Wt&&oe){const X=mt(Kt[0]);e.texStorage2D(s.TEXTURE_2D,pt,Ft,X.width,X.height)}for(let X=0,J=Kt.length;X<J;X++)wt=Kt[X],Wt?D&&e.texSubImage2D(s.TEXTURE_2D,X,0,0,bt,Ot,wt):e.texImage2D(s.TEXTURE_2D,X,Ft,bt,Ot,wt);b.generateMipmaps=!1}else if(Wt){if(oe){const X=mt(it);e.texStorage2D(s.TEXTURE_2D,pt,Ft,X.width,X.height)}D&&e.texSubImage2D(s.TEXTURE_2D,0,0,0,bt,Ot,it)}else e.texImage2D(s.TEXTURE_2D,0,Ft,bt,Ot,it);m(b)&&f(K),Et.__version=$.version,b.onUpdate&&b.onUpdate(b)}E.__version=b.version}function nt(E,b,z){if(b.image.length!==6)return;const K=jt(E,b),tt=b.source;e.bindTexture(s.TEXTURE_CUBE_MAP,E.__webglTexture,s.TEXTURE0+z);const $=i.get(tt);if(tt.version!==$.__version||K===!0){e.activeTexture(s.TEXTURE0+z);const Et=Jt.getPrimaries(Jt.workingColorSpace),ft=b.colorSpace===Ui?null:Jt.getPrimaries(b.colorSpace),yt=b.colorSpace===Ui||Et===ft?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,b.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,b.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,b.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,yt);const Yt=b.isCompressedTexture||b.image[0].isCompressedTexture,it=b.image[0]&&b.image[0].isDataTexture,bt=[];for(let J=0;J<6;J++)!Yt&&!it?bt[J]=v(b.image[J],!0,n.maxCubemapSize):bt[J]=it?b.image[J].image:b.image[J],bt[J]=Dt(b,bt[J]);const Ot=bt[0],Ft=r.convert(b.format,b.colorSpace),wt=r.convert(b.type),Kt=y(b.internalFormat,Ft,wt,b.colorSpace),Wt=b.isVideoTexture!==!0,oe=$.__version===void 0||K===!0,D=tt.dataReady;let pt=I(b,Ot);zt(s.TEXTURE_CUBE_MAP,b);let X;if(Yt){Wt&&oe&&e.texStorage2D(s.TEXTURE_CUBE_MAP,pt,Kt,Ot.width,Ot.height);for(let J=0;J<6;J++){X=bt[J].mipmaps;for(let _t=0;_t<X.length;_t++){const vt=X[_t];b.format!==Ke?Ft!==null?Wt?D&&e.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,_t,0,0,vt.width,vt.height,Ft,vt.data):e.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,_t,Kt,vt.width,vt.height,0,vt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Wt?D&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,_t,0,0,vt.width,vt.height,Ft,wt,vt.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,_t,Kt,vt.width,vt.height,0,Ft,wt,vt.data)}}}else{if(X=b.mipmaps,Wt&&oe){X.length>0&&pt++;const J=mt(bt[0]);e.texStorage2D(s.TEXTURE_CUBE_MAP,pt,Kt,J.width,J.height)}for(let J=0;J<6;J++)if(it){Wt?D&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,0,0,bt[J].width,bt[J].height,Ft,wt,bt[J].data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,Kt,bt[J].width,bt[J].height,0,Ft,wt,bt[J].data);for(let _t=0;_t<X.length;_t++){const Ht=X[_t].image[J].image;Wt?D&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,_t+1,0,0,Ht.width,Ht.height,Ft,wt,Ht.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,_t+1,Kt,Ht.width,Ht.height,0,Ft,wt,Ht.data)}}else{Wt?D&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,0,0,Ft,wt,bt[J]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,Kt,Ft,wt,bt[J]);for(let _t=0;_t<X.length;_t++){const vt=X[_t];Wt?D&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,_t+1,0,0,Ft,wt,vt.image[J]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+J,_t+1,Kt,Ft,wt,vt.image[J])}}}m(b)&&f(s.TEXTURE_CUBE_MAP),$.__version=tt.version,b.onUpdate&&b.onUpdate(b)}E.__version=b.version}function St(E,b,z,K,tt,$){const Et=r.convert(z.format,z.colorSpace),ft=r.convert(z.type),yt=y(z.internalFormat,Et,ft,z.colorSpace),Yt=i.get(b),it=i.get(z);if(it.__renderTarget=b,!Yt.__hasExternalTextures){const bt=Math.max(1,b.width>>$),Ot=Math.max(1,b.height>>$);tt===s.TEXTURE_3D||tt===s.TEXTURE_2D_ARRAY?e.texImage3D(tt,$,yt,bt,Ot,b.depth,0,Et,ft,null):e.texImage2D(tt,$,yt,bt,Ot,0,Et,ft,null)}e.bindFramebuffer(s.FRAMEBUFFER,E),ut(b)?o.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,K,tt,it.__webglTexture,0,j(b)):(tt===s.TEXTURE_2D||tt>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&tt<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,K,tt,it.__webglTexture,$),e.bindFramebuffer(s.FRAMEBUFFER,null)}function at(E,b,z){if(s.bindRenderbuffer(s.RENDERBUFFER,E),b.depthBuffer){const K=b.depthTexture,tt=K&&K.isDepthTexture?K.type:null,$=x(b.stencilBuffer,tt),Et=b.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ft=j(b);ut(b)?o.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,ft,$,b.width,b.height):z?s.renderbufferStorageMultisample(s.RENDERBUFFER,ft,$,b.width,b.height):s.renderbufferStorage(s.RENDERBUFFER,$,b.width,b.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,Et,s.RENDERBUFFER,E)}else{const K=b.textures;for(let tt=0;tt<K.length;tt++){const $=K[tt],Et=r.convert($.format,$.colorSpace),ft=r.convert($.type),yt=y($.internalFormat,Et,ft,$.colorSpace),Yt=j(b);z&&ut(b)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,Yt,yt,b.width,b.height):ut(b)?o.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,Yt,yt,b.width,b.height):s.renderbufferStorage(s.RENDERBUFFER,yt,b.width,b.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function Lt(E,b){if(b&&b.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(s.FRAMEBUFFER,E),!(b.depthTexture&&b.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const K=i.get(b.depthTexture);K.__renderTarget=b,(!K.__webglTexture||b.depthTexture.image.width!==b.width||b.depthTexture.image.height!==b.height)&&(b.depthTexture.image.width=b.width,b.depthTexture.image.height=b.height,b.depthTexture.needsUpdate=!0),q(b.depthTexture,0);const tt=K.__webglTexture,$=j(b);if(b.depthTexture.format===kn)ut(b)?o.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,tt,0,$):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,tt,0);else if(b.depthTexture.format===Xn)ut(b)?o.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,tt,0,$):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,tt,0);else throw new Error("Unknown depthTexture format")}function kt(E){const b=i.get(E),z=E.isWebGLCubeRenderTarget===!0;if(b.__boundDepthTexture!==E.depthTexture){const K=E.depthTexture;if(b.__depthDisposeCallback&&b.__depthDisposeCallback(),K){const tt=()=>{delete b.__boundDepthTexture,delete b.__depthDisposeCallback,K.removeEventListener("dispose",tt)};K.addEventListener("dispose",tt),b.__depthDisposeCallback=tt}b.__boundDepthTexture=K}if(E.depthTexture&&!b.__autoAllocateDepthBuffer){if(z)throw new Error("target.depthTexture not supported in Cube render targets");Lt(b.__webglFramebuffer,E)}else if(z){b.__webglDepthbuffer=[];for(let K=0;K<6;K++)if(e.bindFramebuffer(s.FRAMEBUFFER,b.__webglFramebuffer[K]),b.__webglDepthbuffer[K]===void 0)b.__webglDepthbuffer[K]=s.createRenderbuffer(),at(b.__webglDepthbuffer[K],E,!1);else{const tt=E.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,$=b.__webglDepthbuffer[K];s.bindRenderbuffer(s.RENDERBUFFER,$),s.framebufferRenderbuffer(s.FRAMEBUFFER,tt,s.RENDERBUFFER,$)}}else if(e.bindFramebuffer(s.FRAMEBUFFER,b.__webglFramebuffer),b.__webglDepthbuffer===void 0)b.__webglDepthbuffer=s.createRenderbuffer(),at(b.__webglDepthbuffer,E,!1);else{const K=E.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,tt=b.__webglDepthbuffer;s.bindRenderbuffer(s.RENDERBUFFER,tt),s.framebufferRenderbuffer(s.FRAMEBUFFER,K,s.RENDERBUFFER,tt)}e.bindFramebuffer(s.FRAMEBUFFER,null)}function Nt(E,b,z){const K=i.get(E);b!==void 0&&St(K.__webglFramebuffer,E,E.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),z!==void 0&&kt(E)}function qt(E){const b=E.texture,z=i.get(E),K=i.get(b);E.addEventListener("dispose",C);const tt=E.textures,$=E.isWebGLCubeRenderTarget===!0,Et=tt.length>1;if(Et||(K.__webglTexture===void 0&&(K.__webglTexture=s.createTexture()),K.__version=b.version,a.memory.textures++),$){z.__webglFramebuffer=[];for(let ft=0;ft<6;ft++)if(b.mipmaps&&b.mipmaps.length>0){z.__webglFramebuffer[ft]=[];for(let yt=0;yt<b.mipmaps.length;yt++)z.__webglFramebuffer[ft][yt]=s.createFramebuffer()}else z.__webglFramebuffer[ft]=s.createFramebuffer()}else{if(b.mipmaps&&b.mipmaps.length>0){z.__webglFramebuffer=[];for(let ft=0;ft<b.mipmaps.length;ft++)z.__webglFramebuffer[ft]=s.createFramebuffer()}else z.__webglFramebuffer=s.createFramebuffer();if(Et)for(let ft=0,yt=tt.length;ft<yt;ft++){const Yt=i.get(tt[ft]);Yt.__webglTexture===void 0&&(Yt.__webglTexture=s.createTexture(),a.memory.textures++)}if(E.samples>0&&ut(E)===!1){z.__webglMultisampledFramebuffer=s.createFramebuffer(),z.__webglColorRenderbuffer=[],e.bindFramebuffer(s.FRAMEBUFFER,z.__webglMultisampledFramebuffer);for(let ft=0;ft<tt.length;ft++){const yt=tt[ft];z.__webglColorRenderbuffer[ft]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,z.__webglColorRenderbuffer[ft]);const Yt=r.convert(yt.format,yt.colorSpace),it=r.convert(yt.type),bt=y(yt.internalFormat,Yt,it,yt.colorSpace,E.isXRRenderTarget===!0),Ot=j(E);s.renderbufferStorageMultisample(s.RENDERBUFFER,Ot,bt,E.width,E.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+ft,s.RENDERBUFFER,z.__webglColorRenderbuffer[ft])}s.bindRenderbuffer(s.RENDERBUFFER,null),E.depthBuffer&&(z.__webglDepthRenderbuffer=s.createRenderbuffer(),at(z.__webglDepthRenderbuffer,E,!0)),e.bindFramebuffer(s.FRAMEBUFFER,null)}}if($){e.bindTexture(s.TEXTURE_CUBE_MAP,K.__webglTexture),zt(s.TEXTURE_CUBE_MAP,b);for(let ft=0;ft<6;ft++)if(b.mipmaps&&b.mipmaps.length>0)for(let yt=0;yt<b.mipmaps.length;yt++)St(z.__webglFramebuffer[ft][yt],E,b,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ft,yt);else St(z.__webglFramebuffer[ft],E,b,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ft,0);m(b)&&f(s.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(Et){for(let ft=0,yt=tt.length;ft<yt;ft++){const Yt=tt[ft],it=i.get(Yt);e.bindTexture(s.TEXTURE_2D,it.__webglTexture),zt(s.TEXTURE_2D,Yt),St(z.__webglFramebuffer,E,Yt,s.COLOR_ATTACHMENT0+ft,s.TEXTURE_2D,0),m(Yt)&&f(s.TEXTURE_2D)}e.unbindTexture()}else{let ft=s.TEXTURE_2D;if((E.isWebGL3DRenderTarget||E.isWebGLArrayRenderTarget)&&(ft=E.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),e.bindTexture(ft,K.__webglTexture),zt(ft,b),b.mipmaps&&b.mipmaps.length>0)for(let yt=0;yt<b.mipmaps.length;yt++)St(z.__webglFramebuffer[yt],E,b,s.COLOR_ATTACHMENT0,ft,yt);else St(z.__webglFramebuffer,E,b,s.COLOR_ATTACHMENT0,ft,0);m(b)&&f(ft),e.unbindTexture()}E.depthBuffer&&kt(E)}function Q(E){const b=E.textures;for(let z=0,K=b.length;z<K;z++){const tt=b[z];if(m(tt)){const $=M(E),Et=i.get(tt).__webglTexture;e.bindTexture($,Et),f($),e.unbindTexture()}}}const st=[],T=[];function et(E){if(E.samples>0){if(ut(E)===!1){const b=E.textures,z=E.width,K=E.height;let tt=s.COLOR_BUFFER_BIT;const $=E.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,Et=i.get(E),ft=b.length>1;if(ft)for(let yt=0;yt<b.length;yt++)e.bindFramebuffer(s.FRAMEBUFFER,Et.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+yt,s.RENDERBUFFER,null),e.bindFramebuffer(s.FRAMEBUFFER,Et.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+yt,s.TEXTURE_2D,null,0);e.bindFramebuffer(s.READ_FRAMEBUFFER,Et.__webglMultisampledFramebuffer),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,Et.__webglFramebuffer);for(let yt=0;yt<b.length;yt++){if(E.resolveDepthBuffer&&(E.depthBuffer&&(tt|=s.DEPTH_BUFFER_BIT),E.stencilBuffer&&E.resolveStencilBuffer&&(tt|=s.STENCIL_BUFFER_BIT)),ft){s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,Et.__webglColorRenderbuffer[yt]);const Yt=i.get(b[yt]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,Yt,0)}s.blitFramebuffer(0,0,z,K,0,0,z,K,tt,s.NEAREST),l===!0&&(st.length=0,T.length=0,st.push(s.COLOR_ATTACHMENT0+yt),E.depthBuffer&&E.resolveDepthBuffer===!1&&(st.push($),T.push($),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,T)),s.invalidateFramebuffer(s.READ_FRAMEBUFFER,st))}if(e.bindFramebuffer(s.READ_FRAMEBUFFER,null),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),ft)for(let yt=0;yt<b.length;yt++){e.bindFramebuffer(s.FRAMEBUFFER,Et.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+yt,s.RENDERBUFFER,Et.__webglColorRenderbuffer[yt]);const Yt=i.get(b[yt]).__webglTexture;e.bindFramebuffer(s.FRAMEBUFFER,Et.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+yt,s.TEXTURE_2D,Yt,0)}e.bindFramebuffer(s.DRAW_FRAMEBUFFER,Et.__webglMultisampledFramebuffer)}else if(E.depthBuffer&&E.resolveDepthBuffer===!1&&l){const b=E.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[b])}}}function j(E){return Math.min(n.maxSamples,E.samples)}function ut(E){const b=i.get(E);return E.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&b.__useRenderToTexture!==!1}function ot(E){const b=a.render.frame;h.get(E)!==b&&(h.set(E,b),E.update())}function Dt(E,b){const z=E.colorSpace,K=E.format,tt=E.type;return E.isCompressedTexture===!0||E.isVideoTexture===!0||z!==Kn&&z!==Ui&&(Jt.getTransfer(z)===re?(K!==Ke||tt!==Mi)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",z)),b}function mt(E){return typeof HTMLImageElement<"u"&&E instanceof HTMLImageElement?(c.width=E.naturalWidth||E.width,c.height=E.naturalHeight||E.height):typeof VideoFrame<"u"&&E instanceof VideoFrame?(c.width=E.displayWidth,c.height=E.displayHeight):(c.width=E.width,c.height=E.height),c}this.allocateTextureUnit=F,this.resetTextureUnits=O,this.setTexture2D=q,this.setTexture2DArray=W,this.setTexture3D=Z,this.setTextureCube=V,this.rebindTextures=Nt,this.setupRenderTarget=qt,this.updateRenderTargetMipmap=Q,this.updateMultisampleRenderTarget=et,this.setupDepthRenderbuffer=kt,this.setupFrameBufferTexture=St,this.useMultisampledRTT=ut}function rg(s,t){function e(i,n=Ui){let r;const a=Jt.getTransfer(n);if(i===Mi)return s.UNSIGNED_BYTE;if(i===Lo)return s.UNSIGNED_SHORT_4_4_4_4;if(i===Po)return s.UNSIGNED_SHORT_5_5_5_1;if(i===Gc)return s.UNSIGNED_INT_5_9_9_9_REV;if(i===Bc)return s.BYTE;if(i===Hc)return s.SHORT;if(i===Ss)return s.UNSIGNED_SHORT;if(i===Co)return s.INT;if(i===sn)return s.UNSIGNED_INT;if(i===li)return s.FLOAT;if(i===Is)return s.HALF_FLOAT;if(i===Vc)return s.ALPHA;if(i===Wc)return s.RGB;if(i===Ke)return s.RGBA;if(i===Xc)return s.LUMINANCE;if(i===qc)return s.LUMINANCE_ALPHA;if(i===kn)return s.DEPTH_COMPONENT;if(i===Xn)return s.DEPTH_STENCIL;if(i===Io)return s.RED;if(i===Do)return s.RED_INTEGER;if(i===Yc)return s.RG;if(i===Uo)return s.RG_INTEGER;if(i===No)return s.RGBA_INTEGER;if(i===gr||i===vr||i===xr||i===_r)if(a===re)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(i===gr)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===vr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===xr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===_r)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(i===gr)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===vr)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===xr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===_r)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Va||i===Wa||i===Xa||i===qa)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(i===Va)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Wa)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Xa)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===qa)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Ya||i===Ka||i===$a)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(i===Ya||i===Ka)return a===re?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(i===$a)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(i===ja||i===Za||i===Ja||i===Qa||i===to||i===eo||i===io||i===no||i===so||i===ro||i===ao||i===oo||i===lo||i===co)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(i===ja)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Za)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Ja)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Qa)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===to)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===eo)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===io)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===no)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===so)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===ro)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===ao)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===oo)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===lo)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===co)return a===re?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===yr||i===ho||i===uo)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(i===yr)return a===re?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===ho)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===uo)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Kc||i===fo||i===po||i===mo)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(i===yr)return r.COMPRESSED_RED_RGTC1_EXT;if(i===fo)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===po)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===mo)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Wn?s.UNSIGNED_INT_24_8:s[i]!==void 0?s[i]:null}return{convert:e}}class ag extends We{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class Se extends xe{constructor(){super(),this.isGroup=!0,this.type="Group"}}const og={type:"move"};class _a{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Se,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Se,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new R,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new R),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Se,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new R,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new R),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const i of t.hand.values())this._getHandJoint(e,i)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,i){let n=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){a=!0;for(const v of t.hand.values()){const m=e.getJointPose(v,i),f=this._getHandJoint(c,v);m!==null&&(f.matrix.fromArray(m.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=m.radius),f.visible=m!==null}const h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),p=.02,g=.005;c.inputState.pinching&&d>p+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&d<=p-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,i),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(n=e.getPose(t.targetRaySpace,i),n===null&&r!==null&&(n=r),n!==null&&(o.matrix.fromArray(n.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,n.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(n.linearVelocity)):o.hasLinearVelocity=!1,n.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(n.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(og)))}return o!==null&&(o.visible=n!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const i=new Se;i.matrixAutoUpdate=!1,i.visible=!1,t.joints[e.jointName]=i,t.add(i)}return t.joints[e.jointName]}}const lg=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,cg=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class hg{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e,i){if(this.texture===null){const n=new Ue,r=t.properties.get(n);r.__webglTexture=e.texture,(e.depthNear!=i.depthNear||e.depthFar!=i.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(t){if(this.texture!==null&&this.mesh===null){const e=t.cameras[0].viewport,i=new Si({vertexShader:lg,fragmentShader:cg,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new gt(new Dr(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class ug extends $n{constructor(t,e){super();const i=this;let n=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,p=null,g=null;const v=new hg,m=e.getContextAttributes();let f=null,M=null;const y=[],x=[],I=new lt;let A=null;const C=new We;C.viewport=new ae;const P=new We;P.viewport=new ae;const S=[C,P],_=new ag;let L=null,O=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let nt=y[Y];return nt===void 0&&(nt=new _a,y[Y]=nt),nt.getTargetRaySpace()},this.getControllerGrip=function(Y){let nt=y[Y];return nt===void 0&&(nt=new _a,y[Y]=nt),nt.getGripSpace()},this.getHand=function(Y){let nt=y[Y];return nt===void 0&&(nt=new _a,y[Y]=nt),nt.getHandSpace()};function F(Y){const nt=x.indexOf(Y.inputSource);if(nt===-1)return;const St=y[nt];St!==void 0&&(St.update(Y.inputSource,Y.frame,c||a),St.dispatchEvent({type:Y.type,data:Y.inputSource}))}function G(){n.removeEventListener("select",F),n.removeEventListener("selectstart",F),n.removeEventListener("selectend",F),n.removeEventListener("squeeze",F),n.removeEventListener("squeezestart",F),n.removeEventListener("squeezeend",F),n.removeEventListener("end",G),n.removeEventListener("inputsourceschange",q);for(let Y=0;Y<y.length;Y++){const nt=x[Y];nt!==null&&(x[Y]=null,y[Y].disconnect(nt))}L=null,O=null,v.reset(),t.setRenderTarget(f),p=null,d=null,u=null,n=null,M=null,jt.stop(),i.isPresenting=!1,t.setPixelRatio(A),t.setSize(I.width,I.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){r=Y,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){o=Y,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return d!==null?d:p},this.getBinding=function(){return u},this.getFrame=function(){return g},this.getSession=function(){return n},this.setSession=async function(Y){if(n=Y,n!==null){if(f=t.getRenderTarget(),n.addEventListener("select",F),n.addEventListener("selectstart",F),n.addEventListener("selectend",F),n.addEventListener("squeeze",F),n.addEventListener("squeezestart",F),n.addEventListener("squeezeend",F),n.addEventListener("end",G),n.addEventListener("inputsourceschange",q),m.xrCompatible!==!0&&await e.makeXRCompatible(),A=t.getPixelRatio(),t.getSize(I),n.renderState.layers===void 0){const nt={antialias:m.antialias,alpha:!0,depth:m.depth,stencil:m.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(n,e,nt),n.updateRenderState({baseLayer:p}),t.setPixelRatio(1),t.setSize(p.framebufferWidth,p.framebufferHeight,!1),M=new rn(p.framebufferWidth,p.framebufferHeight,{format:Ke,type:Mi,colorSpace:t.outputColorSpace,stencilBuffer:m.stencil})}else{let nt=null,St=null,at=null;m.depth&&(at=m.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,nt=m.stencil?Xn:kn,St=m.stencil?Wn:sn);const Lt={colorFormat:e.RGBA8,depthFormat:at,scaleFactor:r};u=new XRWebGLBinding(n,e),d=u.createProjectionLayer(Lt),n.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),M=new rn(d.textureWidth,d.textureHeight,{format:Ke,type:Mi,depthTexture:new lh(d.textureWidth,d.textureHeight,St,void 0,void 0,void 0,void 0,void 0,void 0,nt),stencilBuffer:m.stencil,colorSpace:t.outputColorSpace,samples:m.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1})}M.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await n.requestReferenceSpace(o),jt.setContext(n),jt.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(n!==null)return n.environmentBlendMode},this.getDepthTexture=function(){return v.getDepthTexture()};function q(Y){for(let nt=0;nt<Y.removed.length;nt++){const St=Y.removed[nt],at=x.indexOf(St);at>=0&&(x[at]=null,y[at].disconnect(St))}for(let nt=0;nt<Y.added.length;nt++){const St=Y.added[nt];let at=x.indexOf(St);if(at===-1){for(let kt=0;kt<y.length;kt++)if(kt>=x.length){x.push(St),at=kt;break}else if(x[kt]===null){x[kt]=St,at=kt;break}if(at===-1)break}const Lt=y[at];Lt&&Lt.connect(St)}}const W=new R,Z=new R;function V(Y,nt,St){W.setFromMatrixPosition(nt.matrixWorld),Z.setFromMatrixPosition(St.matrixWorld);const at=W.distanceTo(Z),Lt=nt.projectionMatrix.elements,kt=St.projectionMatrix.elements,Nt=Lt[14]/(Lt[10]-1),qt=Lt[14]/(Lt[10]+1),Q=(Lt[9]+1)/Lt[5],st=(Lt[9]-1)/Lt[5],T=(Lt[8]-1)/Lt[0],et=(kt[8]+1)/kt[0],j=Nt*T,ut=Nt*et,ot=at/(-T+et),Dt=ot*-T;if(nt.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(Dt),Y.translateZ(ot),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),Lt[10]===-1)Y.projectionMatrix.copy(nt.projectionMatrix),Y.projectionMatrixInverse.copy(nt.projectionMatrixInverse);else{const mt=Nt+ot,E=qt+ot,b=j-Dt,z=ut+(at-Dt),K=Q*qt/E*mt,tt=st*qt/E*mt;Y.projectionMatrix.makePerspective(b,z,K,tt,mt,E),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function ct(Y,nt){nt===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(nt.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(n===null)return;let nt=Y.near,St=Y.far;v.texture!==null&&(v.depthNear>0&&(nt=v.depthNear),v.depthFar>0&&(St=v.depthFar)),_.near=P.near=C.near=nt,_.far=P.far=C.far=St,(L!==_.near||O!==_.far)&&(n.updateRenderState({depthNear:_.near,depthFar:_.far}),L=_.near,O=_.far),C.layers.mask=Y.layers.mask|2,P.layers.mask=Y.layers.mask|4,_.layers.mask=C.layers.mask|P.layers.mask;const at=Y.parent,Lt=_.cameras;ct(_,at);for(let kt=0;kt<Lt.length;kt++)ct(Lt[kt],at);Lt.length===2?V(_,C,P):_.projectionMatrix.copy(C.projectionMatrix),ht(Y,_,at)};function ht(Y,nt,St){St===null?Y.matrix.copy(nt.matrixWorld):(Y.matrix.copy(St.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(nt.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(nt.projectionMatrix),Y.projectionMatrixInverse.copy(nt.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=bs*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return _},this.getFoveation=function(){if(!(d===null&&p===null))return l},this.setFoveation=function(Y){l=Y,d!==null&&(d.fixedFoveation=Y),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=Y)},this.hasDepthSensing=function(){return v.texture!==null},this.getDepthSensingMesh=function(){return v.getMesh(_)};let Mt=null;function zt(Y,nt){if(h=nt.getViewerPose(c||a),g=nt,h!==null){const St=h.views;p!==null&&(t.setRenderTargetFramebuffer(M,p.framebuffer),t.setRenderTarget(M));let at=!1;St.length!==_.cameras.length&&(_.cameras.length=0,at=!0);for(let kt=0;kt<St.length;kt++){const Nt=St[kt];let qt=null;if(p!==null)qt=p.getViewport(Nt);else{const st=u.getViewSubImage(d,Nt);qt=st.viewport,kt===0&&(t.setRenderTargetTextures(M,st.colorTexture,d.ignoreDepthValues?void 0:st.depthStencilTexture),t.setRenderTarget(M))}let Q=S[kt];Q===void 0&&(Q=new We,Q.layers.enable(kt),Q.viewport=new ae,S[kt]=Q),Q.matrix.fromArray(Nt.transform.matrix),Q.matrix.decompose(Q.position,Q.quaternion,Q.scale),Q.projectionMatrix.fromArray(Nt.projectionMatrix),Q.projectionMatrixInverse.copy(Q.projectionMatrix).invert(),Q.viewport.set(qt.x,qt.y,qt.width,qt.height),kt===0&&(_.matrix.copy(Q.matrix),_.matrix.decompose(_.position,_.quaternion,_.scale)),at===!0&&_.cameras.push(Q)}const Lt=n.enabledFeatures;if(Lt&&Lt.includes("depth-sensing")){const kt=u.getDepthInformation(St[0]);kt&&kt.isValid&&kt.texture&&v.init(t,kt,n.renderState)}}for(let St=0;St<y.length;St++){const at=x[St],Lt=y[St];at!==null&&Lt!==void 0&&Lt.update(at,nt,c||a)}Mt&&Mt(Y,nt),nt.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:nt}),g=null}const jt=new ah;jt.setAnimationLoop(zt),this.setAnimationLoop=function(Y){Mt=Y},this.dispose=function(){}}}const Yi=new ci,dg=new se;function fg(s,t){function e(m,f){m.matrixAutoUpdate===!0&&m.updateMatrix(),f.value.copy(m.matrix)}function i(m,f){f.color.getRGB(m.fogColor.value,nh(s)),f.isFog?(m.fogNear.value=f.near,m.fogFar.value=f.far):f.isFogExp2&&(m.fogDensity.value=f.density)}function n(m,f,M,y,x){f.isMeshBasicMaterial||f.isMeshLambertMaterial?r(m,f):f.isMeshToonMaterial?(r(m,f),u(m,f)):f.isMeshPhongMaterial?(r(m,f),h(m,f)):f.isMeshStandardMaterial?(r(m,f),d(m,f),f.isMeshPhysicalMaterial&&p(m,f,x)):f.isMeshMatcapMaterial?(r(m,f),g(m,f)):f.isMeshDepthMaterial?r(m,f):f.isMeshDistanceMaterial?(r(m,f),v(m,f)):f.isMeshNormalMaterial?r(m,f):f.isLineBasicMaterial?(a(m,f),f.isLineDashedMaterial&&o(m,f)):f.isPointsMaterial?l(m,f,M,y):f.isSpriteMaterial?c(m,f):f.isShadowMaterial?(m.color.value.copy(f.color),m.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function r(m,f){m.opacity.value=f.opacity,f.color&&m.diffuse.value.copy(f.color),f.emissive&&m.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(m.map.value=f.map,e(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,e(f.alphaMap,m.alphaMapTransform)),f.bumpMap&&(m.bumpMap.value=f.bumpMap,e(f.bumpMap,m.bumpMapTransform),m.bumpScale.value=f.bumpScale,f.side===De&&(m.bumpScale.value*=-1)),f.normalMap&&(m.normalMap.value=f.normalMap,e(f.normalMap,m.normalMapTransform),m.normalScale.value.copy(f.normalScale),f.side===De&&m.normalScale.value.negate()),f.displacementMap&&(m.displacementMap.value=f.displacementMap,e(f.displacementMap,m.displacementMapTransform),m.displacementScale.value=f.displacementScale,m.displacementBias.value=f.displacementBias),f.emissiveMap&&(m.emissiveMap.value=f.emissiveMap,e(f.emissiveMap,m.emissiveMapTransform)),f.specularMap&&(m.specularMap.value=f.specularMap,e(f.specularMap,m.specularMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest);const M=t.get(f),y=M.envMap,x=M.envMapRotation;y&&(m.envMap.value=y,Yi.copy(x),Yi.x*=-1,Yi.y*=-1,Yi.z*=-1,y.isCubeTexture&&y.isRenderTargetTexture===!1&&(Yi.y*=-1,Yi.z*=-1),m.envMapRotation.value.setFromMatrix4(dg.makeRotationFromEuler(Yi)),m.flipEnvMap.value=y.isCubeTexture&&y.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=f.reflectivity,m.ior.value=f.ior,m.refractionRatio.value=f.refractionRatio),f.lightMap&&(m.lightMap.value=f.lightMap,m.lightMapIntensity.value=f.lightMapIntensity,e(f.lightMap,m.lightMapTransform)),f.aoMap&&(m.aoMap.value=f.aoMap,m.aoMapIntensity.value=f.aoMapIntensity,e(f.aoMap,m.aoMapTransform))}function a(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,f.map&&(m.map.value=f.map,e(f.map,m.mapTransform))}function o(m,f){m.dashSize.value=f.dashSize,m.totalSize.value=f.dashSize+f.gapSize,m.scale.value=f.scale}function l(m,f,M,y){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.size.value=f.size*M,m.scale.value=y*.5,f.map&&(m.map.value=f.map,e(f.map,m.uvTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,e(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function c(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.rotation.value=f.rotation,f.map&&(m.map.value=f.map,e(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,e(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function h(m,f){m.specular.value.copy(f.specular),m.shininess.value=Math.max(f.shininess,1e-4)}function u(m,f){f.gradientMap&&(m.gradientMap.value=f.gradientMap)}function d(m,f){m.metalness.value=f.metalness,f.metalnessMap&&(m.metalnessMap.value=f.metalnessMap,e(f.metalnessMap,m.metalnessMapTransform)),m.roughness.value=f.roughness,f.roughnessMap&&(m.roughnessMap.value=f.roughnessMap,e(f.roughnessMap,m.roughnessMapTransform)),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)}function p(m,f,M){m.ior.value=f.ior,f.sheen>0&&(m.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),m.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(m.sheenColorMap.value=f.sheenColorMap,e(f.sheenColorMap,m.sheenColorMapTransform)),f.sheenRoughnessMap&&(m.sheenRoughnessMap.value=f.sheenRoughnessMap,e(f.sheenRoughnessMap,m.sheenRoughnessMapTransform))),f.clearcoat>0&&(m.clearcoat.value=f.clearcoat,m.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(m.clearcoatMap.value=f.clearcoatMap,e(f.clearcoatMap,m.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,e(f.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(m.clearcoatNormalMap.value=f.clearcoatNormalMap,e(f.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===De&&m.clearcoatNormalScale.value.negate())),f.dispersion>0&&(m.dispersion.value=f.dispersion),f.iridescence>0&&(m.iridescence.value=f.iridescence,m.iridescenceIOR.value=f.iridescenceIOR,m.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(m.iridescenceMap.value=f.iridescenceMap,e(f.iridescenceMap,m.iridescenceMapTransform)),f.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=f.iridescenceThicknessMap,e(f.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),f.transmission>0&&(m.transmission.value=f.transmission,m.transmissionSamplerMap.value=M.texture,m.transmissionSamplerSize.value.set(M.width,M.height),f.transmissionMap&&(m.transmissionMap.value=f.transmissionMap,e(f.transmissionMap,m.transmissionMapTransform)),m.thickness.value=f.thickness,f.thicknessMap&&(m.thicknessMap.value=f.thicknessMap,e(f.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=f.attenuationDistance,m.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(m.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(m.anisotropyMap.value=f.anisotropyMap,e(f.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=f.specularIntensity,m.specularColor.value.copy(f.specularColor),f.specularColorMap&&(m.specularColorMap.value=f.specularColorMap,e(f.specularColorMap,m.specularColorMapTransform)),f.specularIntensityMap&&(m.specularIntensityMap.value=f.specularIntensityMap,e(f.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,f){f.matcap&&(m.matcap.value=f.matcap)}function v(m,f){const M=t.get(f).light;m.referencePosition.value.setFromMatrixPosition(M.matrixWorld),m.nearDistance.value=M.shadow.camera.near,m.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:n}}function pg(s,t,e,i){let n={},r={},a=[];const o=s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS);function l(M,y){const x=y.program;i.uniformBlockBinding(M,x)}function c(M,y){let x=n[M.id];x===void 0&&(g(M),x=h(M),n[M.id]=x,M.addEventListener("dispose",m));const I=y.program;i.updateUBOMapping(M,I);const A=t.render.frame;r[M.id]!==A&&(d(M),r[M.id]=A)}function h(M){const y=u();M.__bindingPointIndex=y;const x=s.createBuffer(),I=M.__size,A=M.usage;return s.bindBuffer(s.UNIFORM_BUFFER,x),s.bufferData(s.UNIFORM_BUFFER,I,A),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,y,x),x}function u(){for(let M=0;M<o;M++)if(a.indexOf(M)===-1)return a.push(M),M;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(M){const y=n[M.id],x=M.uniforms,I=M.__cache;s.bindBuffer(s.UNIFORM_BUFFER,y);for(let A=0,C=x.length;A<C;A++){const P=Array.isArray(x[A])?x[A]:[x[A]];for(let S=0,_=P.length;S<_;S++){const L=P[S];if(p(L,A,S,I)===!0){const O=L.__offset,F=Array.isArray(L.value)?L.value:[L.value];let G=0;for(let q=0;q<F.length;q++){const W=F[q],Z=v(W);typeof W=="number"||typeof W=="boolean"?(L.__data[0]=W,s.bufferSubData(s.UNIFORM_BUFFER,O+G,L.__data)):W.isMatrix3?(L.__data[0]=W.elements[0],L.__data[1]=W.elements[1],L.__data[2]=W.elements[2],L.__data[3]=0,L.__data[4]=W.elements[3],L.__data[5]=W.elements[4],L.__data[6]=W.elements[5],L.__data[7]=0,L.__data[8]=W.elements[6],L.__data[9]=W.elements[7],L.__data[10]=W.elements[8],L.__data[11]=0):(W.toArray(L.__data,G),G+=Z.storage/Float32Array.BYTES_PER_ELEMENT)}s.bufferSubData(s.UNIFORM_BUFFER,O,L.__data)}}}s.bindBuffer(s.UNIFORM_BUFFER,null)}function p(M,y,x,I){const A=M.value,C=y+"_"+x;if(I[C]===void 0)return typeof A=="number"||typeof A=="boolean"?I[C]=A:I[C]=A.clone(),!0;{const P=I[C];if(typeof A=="number"||typeof A=="boolean"){if(P!==A)return I[C]=A,!0}else if(P.equals(A)===!1)return P.copy(A),!0}return!1}function g(M){const y=M.uniforms;let x=0;const I=16;for(let C=0,P=y.length;C<P;C++){const S=Array.isArray(y[C])?y[C]:[y[C]];for(let _=0,L=S.length;_<L;_++){const O=S[_],F=Array.isArray(O.value)?O.value:[O.value];for(let G=0,q=F.length;G<q;G++){const W=F[G],Z=v(W),V=x%I,ct=V%Z.boundary,ht=V+ct;x+=ct,ht!==0&&I-ht<Z.storage&&(x+=I-ht),O.__data=new Float32Array(Z.storage/Float32Array.BYTES_PER_ELEMENT),O.__offset=x,x+=Z.storage}}}const A=x%I;return A>0&&(x+=I-A),M.__size=x,M.__cache={},this}function v(M){const y={boundary:0,storage:0};return typeof M=="number"||typeof M=="boolean"?(y.boundary=4,y.storage=4):M.isVector2?(y.boundary=8,y.storage=8):M.isVector3||M.isColor?(y.boundary=16,y.storage=12):M.isVector4?(y.boundary=16,y.storage=16):M.isMatrix3?(y.boundary=48,y.storage=48):M.isMatrix4?(y.boundary=64,y.storage=64):M.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",M),y}function m(M){const y=M.target;y.removeEventListener("dispose",m);const x=a.indexOf(y.__bindingPointIndex);a.splice(x,1),s.deleteBuffer(n[y.id]),delete n[y.id],delete r[y.id]}function f(){for(const M in n)s.deleteBuffer(n[M]);a=[],n={},r={}}return{bind:l,update:c,dispose:f}}class mg{constructor(t={}){const{canvas:e=id(),context:i=null,depth:n=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reverseDepthBuffer:d=!1}=t;this.isWebGLRenderer=!0;let p;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=i.getContextAttributes().alpha}else p=a;const g=new Uint32Array(4),v=new Int32Array(4);let m=null,f=null;const M=[],y=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=ze,this.toneMapping=ki,this.toneMappingExposure=1;const x=this;let I=!1,A=0,C=0,P=null,S=-1,_=null;const L=new ae,O=new ae;let F=null;const G=new Ut(0);let q=0,W=e.width,Z=e.height,V=1,ct=null,ht=null;const Mt=new ae(0,0,W,Z),zt=new ae(0,0,W,Z);let jt=!1;const Y=new zo;let nt=!1,St=!1;const at=new se,Lt=new se,kt=new R,Nt=new ae,qt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Q=!1;function st(){return P===null?V:1}let T=i;function et(w,U){return e.getContext(w,U)}try{const w={alpha:!0,depth:n,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${Ro}`),e.addEventListener("webglcontextlost",J,!1),e.addEventListener("webglcontextrestored",_t,!1),e.addEventListener("webglcontextcreationerror",vt,!1),T===null){const U="webgl2";if(T=et(U,w),T===null)throw et(U)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(w){throw console.error("THREE.WebGLRenderer: "+w.message),w}let j,ut,ot,Dt,mt,E,b,z,K,tt,$,Et,ft,yt,Yt,it,bt,Ot,Ft,wt,Kt,Wt,oe,D;function pt(){j=new ym(T),j.init(),Wt=new rg(T,j),ut=new pm(T,j,t,Wt),ot=new ig(T,j),ut.reverseDepthBuffer&&d&&ot.buffers.depth.setReversed(!0),Dt=new bm(T),mt=new H0,E=new sg(T,j,ot,mt,ut,Wt,Dt),b=new gm(x),z=new _m(x),K=new Cd(T),oe=new dm(T,K),tt=new Mm(T,K,Dt,oe),$=new Em(T,tt,K,Dt),Ft=new wm(T,ut,E),it=new mm(mt),Et=new B0(x,b,z,j,ut,oe,it),ft=new fg(x,mt),yt=new V0,Yt=new $0(j),Ot=new um(x,b,z,ot,$,p,l),bt=new tg(x,$,ut),D=new pg(T,Dt,ut,ot),wt=new fm(T,j,Dt),Kt=new Sm(T,j,Dt),Dt.programs=Et.programs,x.capabilities=ut,x.extensions=j,x.properties=mt,x.renderLists=yt,x.shadowMap=bt,x.state=ot,x.info=Dt}pt();const X=new ug(x,T);this.xr=X,this.getContext=function(){return T},this.getContextAttributes=function(){return T.getContextAttributes()},this.forceContextLoss=function(){const w=j.get("WEBGL_lose_context");w&&w.loseContext()},this.forceContextRestore=function(){const w=j.get("WEBGL_lose_context");w&&w.restoreContext()},this.getPixelRatio=function(){return V},this.setPixelRatio=function(w){w!==void 0&&(V=w,this.setSize(W,Z,!1))},this.getSize=function(w){return w.set(W,Z)},this.setSize=function(w,U,B=!0){if(X.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}W=w,Z=U,e.width=Math.floor(w*V),e.height=Math.floor(U*V),B===!0&&(e.style.width=w+"px",e.style.height=U+"px"),this.setViewport(0,0,w,U)},this.getDrawingBufferSize=function(w){return w.set(W*V,Z*V).floor()},this.setDrawingBufferSize=function(w,U,B){W=w,Z=U,V=B,e.width=Math.floor(w*B),e.height=Math.floor(U*B),this.setViewport(0,0,w,U)},this.getCurrentViewport=function(w){return w.copy(L)},this.getViewport=function(w){return w.copy(Mt)},this.setViewport=function(w,U,B,H){w.isVector4?Mt.set(w.x,w.y,w.z,w.w):Mt.set(w,U,B,H),ot.viewport(L.copy(Mt).multiplyScalar(V).round())},this.getScissor=function(w){return w.copy(zt)},this.setScissor=function(w,U,B,H){w.isVector4?zt.set(w.x,w.y,w.z,w.w):zt.set(w,U,B,H),ot.scissor(O.copy(zt).multiplyScalar(V).round())},this.getScissorTest=function(){return jt},this.setScissorTest=function(w){ot.setScissorTest(jt=w)},this.setOpaqueSort=function(w){ct=w},this.setTransparentSort=function(w){ht=w},this.getClearColor=function(w){return w.copy(Ot.getClearColor())},this.setClearColor=function(){Ot.setClearColor.apply(Ot,arguments)},this.getClearAlpha=function(){return Ot.getClearAlpha()},this.setClearAlpha=function(){Ot.setClearAlpha.apply(Ot,arguments)},this.clear=function(w=!0,U=!0,B=!0){let H=0;if(w){let N=!1;if(P!==null){const rt=P.texture.format;N=rt===No||rt===Uo||rt===Do}if(N){const rt=P.texture.type,xt=rt===Mi||rt===sn||rt===Ss||rt===Wn||rt===Lo||rt===Po,At=Ot.getClearColor(),Rt=Ot.getClearAlpha(),Bt=At.r,Gt=At.g,Ct=At.b;xt?(g[0]=Bt,g[1]=Gt,g[2]=Ct,g[3]=Rt,T.clearBufferuiv(T.COLOR,0,g)):(v[0]=Bt,v[1]=Gt,v[2]=Ct,v[3]=Rt,T.clearBufferiv(T.COLOR,0,v))}else H|=T.COLOR_BUFFER_BIT}U&&(H|=T.DEPTH_BUFFER_BIT),B&&(H|=T.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),T.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",J,!1),e.removeEventListener("webglcontextrestored",_t,!1),e.removeEventListener("webglcontextcreationerror",vt,!1),yt.dispose(),Yt.dispose(),mt.dispose(),b.dispose(),z.dispose(),$.dispose(),oe.dispose(),D.dispose(),Et.dispose(),X.dispose(),X.removeEventListener("sessionstart",$o),X.removeEventListener("sessionend",jo),Hi.stop()};function J(w){w.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),I=!0}function _t(){console.log("THREE.WebGLRenderer: Context Restored."),I=!1;const w=Dt.autoReset,U=bt.enabled,B=bt.autoUpdate,H=bt.needsUpdate,N=bt.type;pt(),Dt.autoReset=w,bt.enabled=U,bt.autoUpdate=B,bt.needsUpdate=H,bt.type=N}function vt(w){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function Ht(w){const U=w.target;U.removeEventListener("dispose",Ht),ge(U)}function ge(w){Ce(w),mt.remove(w)}function Ce(w){const U=mt.get(w).programs;U!==void 0&&(U.forEach(function(B){Et.releaseProgram(B)}),w.isShaderMaterial&&Et.releaseShaderCache(w))}this.renderBufferDirect=function(w,U,B,H,N,rt){U===null&&(U=qt);const xt=N.isMesh&&N.matrixWorld.determinant()<0,At=Zh(w,U,B,H,N);ot.setMaterial(H,xt);let Rt=B.index,Bt=1;if(H.wireframe===!0){if(Rt=tt.getWireframeAttribute(B),Rt===void 0)return;Bt=2}const Gt=B.drawRange,Ct=B.attributes.position;let Qt=Gt.start*Bt,le=(Gt.start+Gt.count)*Bt;rt!==null&&(Qt=Math.max(Qt,rt.start*Bt),le=Math.min(le,(rt.start+rt.count)*Bt)),Rt!==null?(Qt=Math.max(Qt,0),le=Math.min(le,Rt.count)):Ct!=null&&(Qt=Math.max(Qt,0),le=Math.min(le,Ct.count));const ue=le-Qt;if(ue<0||ue===1/0)return;oe.setup(N,H,At,B,Rt);let Fe,te=wt;if(Rt!==null&&(Fe=K.get(Rt),te=Kt,te.setIndex(Fe)),N.isMesh)H.wireframe===!0?(ot.setLineWidth(H.wireframeLinewidth*st()),te.setMode(T.LINES)):te.setMode(T.TRIANGLES);else if(N.isLine){let Pt=H.linewidth;Pt===void 0&&(Pt=1),ot.setLineWidth(Pt*st()),N.isLineSegments?te.setMode(T.LINES):N.isLineLoop?te.setMode(T.LINE_LOOP):te.setMode(T.LINE_STRIP)}else N.isPoints?te.setMode(T.POINTS):N.isSprite&&te.setMode(T.TRIANGLES);if(N.isBatchedMesh)if(N._multiDrawInstances!==null)te.renderMultiDrawInstances(N._multiDrawStarts,N._multiDrawCounts,N._multiDrawCount,N._multiDrawInstances);else if(j.get("WEBGL_multi_draw"))te.renderMultiDraw(N._multiDrawStarts,N._multiDrawCounts,N._multiDrawCount);else{const Pt=N._multiDrawStarts,di=N._multiDrawCounts,ee=N._multiDrawCount,Je=Rt?K.get(Rt).bytesPerElement:1,fn=mt.get(H).currentProgram.getUniforms();for(let Be=0;Be<ee;Be++)fn.setValue(T,"_gl_DrawID",Be),te.render(Pt[Be]/Je,di[Be])}else if(N.isInstancedMesh)te.renderInstances(Qt,ue,N.count);else if(B.isInstancedBufferGeometry){const Pt=B._maxInstanceCount!==void 0?B._maxInstanceCount:1/0,di=Math.min(B.instanceCount,Pt);te.renderInstances(Qt,ue,di)}else te.render(Qt,ue)};function ie(w,U,B){w.transparent===!0&&w.side===Re&&w.forceSinglePass===!1?(w.side=De,w.needsUpdate=!0,ks(w,U,B),w.side=Oi,w.needsUpdate=!0,ks(w,U,B),w.side=Re):ks(w,U,B)}this.compile=function(w,U,B=null){B===null&&(B=w),f=Yt.get(B),f.init(U),y.push(f),B.traverseVisible(function(N){N.isLight&&N.layers.test(U.layers)&&(f.pushLight(N),N.castShadow&&f.pushShadow(N))}),w!==B&&w.traverseVisible(function(N){N.isLight&&N.layers.test(U.layers)&&(f.pushLight(N),N.castShadow&&f.pushShadow(N))}),f.setupLights();const H=new Set;return w.traverse(function(N){if(!(N.isMesh||N.isPoints||N.isLine||N.isSprite))return;const rt=N.material;if(rt)if(Array.isArray(rt))for(let xt=0;xt<rt.length;xt++){const At=rt[xt];ie(At,B,N),H.add(At)}else ie(rt,B,N),H.add(rt)}),y.pop(),f=null,H},this.compileAsync=function(w,U,B=null){const H=this.compile(w,U,B);return new Promise(N=>{function rt(){if(H.forEach(function(xt){mt.get(xt).currentProgram.isReady()&&H.delete(xt)}),H.size===0){N(w);return}setTimeout(rt,10)}j.get("KHR_parallel_shader_compile")!==null?rt():setTimeout(rt,10)})};let Ze=null;function ui(w){Ze&&Ze(w)}function $o(){Hi.stop()}function jo(){Hi.start()}const Hi=new ah;Hi.setAnimationLoop(ui),typeof self<"u"&&Hi.setContext(self),this.setAnimationLoop=function(w){Ze=w,X.setAnimationLoop(w),w===null?Hi.stop():Hi.start()},X.addEventListener("sessionstart",$o),X.addEventListener("sessionend",jo),this.render=function(w,U){if(U!==void 0&&U.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(I===!0)return;if(w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),U.parent===null&&U.matrixWorldAutoUpdate===!0&&U.updateMatrixWorld(),X.enabled===!0&&X.isPresenting===!0&&(X.cameraAutoUpdate===!0&&X.updateCamera(U),U=X.getCamera()),w.isScene===!0&&w.onBeforeRender(x,w,U,P),f=Yt.get(w,y.length),f.init(U),y.push(f),Lt.multiplyMatrices(U.projectionMatrix,U.matrixWorldInverse),Y.setFromProjectionMatrix(Lt),St=this.localClippingEnabled,nt=it.init(this.clippingPlanes,St),m=yt.get(w,M.length),m.init(),M.push(m),X.enabled===!0&&X.isPresenting===!0){const rt=x.xr.getDepthSensingMesh();rt!==null&&Xr(rt,U,-1/0,x.sortObjects)}Xr(w,U,0,x.sortObjects),m.finish(),x.sortObjects===!0&&m.sort(ct,ht),Q=X.enabled===!1||X.isPresenting===!1||X.hasDepthSensing()===!1,Q&&Ot.addToRenderList(m,w),this.info.render.frame++,nt===!0&&it.beginShadows();const B=f.state.shadowsArray;bt.render(B,w,U),nt===!0&&it.endShadows(),this.info.autoReset===!0&&this.info.reset();const H=m.opaque,N=m.transmissive;if(f.setupLights(),U.isArrayCamera){const rt=U.cameras;if(N.length>0)for(let xt=0,At=rt.length;xt<At;xt++){const Rt=rt[xt];Jo(H,N,w,Rt)}Q&&Ot.render(w);for(let xt=0,At=rt.length;xt<At;xt++){const Rt=rt[xt];Zo(m,w,Rt,Rt.viewport)}}else N.length>0&&Jo(H,N,w,U),Q&&Ot.render(w),Zo(m,w,U);P!==null&&(E.updateMultisampleRenderTarget(P),E.updateRenderTargetMipmap(P)),w.isScene===!0&&w.onAfterRender(x,w,U),oe.resetDefaultState(),S=-1,_=null,y.pop(),y.length>0?(f=y[y.length-1],nt===!0&&it.setGlobalState(x.clippingPlanes,f.state.camera)):f=null,M.pop(),M.length>0?m=M[M.length-1]:m=null};function Xr(w,U,B,H){if(w.visible===!1)return;if(w.layers.test(U.layers)){if(w.isGroup)B=w.renderOrder;else if(w.isLOD)w.autoUpdate===!0&&w.update(U);else if(w.isLight)f.pushLight(w),w.castShadow&&f.pushShadow(w);else if(w.isSprite){if(!w.frustumCulled||Y.intersectsSprite(w)){H&&Nt.setFromMatrixPosition(w.matrixWorld).applyMatrix4(Lt);const xt=$.update(w),At=w.material;At.visible&&m.push(w,xt,At,B,Nt.z,null)}}else if((w.isMesh||w.isLine||w.isPoints)&&(!w.frustumCulled||Y.intersectsObject(w))){const xt=$.update(w),At=w.material;if(H&&(w.boundingSphere!==void 0?(w.boundingSphere===null&&w.computeBoundingSphere(),Nt.copy(w.boundingSphere.center)):(xt.boundingSphere===null&&xt.computeBoundingSphere(),Nt.copy(xt.boundingSphere.center)),Nt.applyMatrix4(w.matrixWorld).applyMatrix4(Lt)),Array.isArray(At)){const Rt=xt.groups;for(let Bt=0,Gt=Rt.length;Bt<Gt;Bt++){const Ct=Rt[Bt],Qt=At[Ct.materialIndex];Qt&&Qt.visible&&m.push(w,xt,Qt,B,Nt.z,Ct)}}else At.visible&&m.push(w,xt,At,B,Nt.z,null)}}const rt=w.children;for(let xt=0,At=rt.length;xt<At;xt++)Xr(rt[xt],U,B,H)}function Zo(w,U,B,H){const N=w.opaque,rt=w.transmissive,xt=w.transparent;f.setupLightsView(B),nt===!0&&it.setGlobalState(x.clippingPlanes,B),H&&ot.viewport(L.copy(H)),N.length>0&&Ns(N,U,B),rt.length>0&&Ns(rt,U,B),xt.length>0&&Ns(xt,U,B),ot.buffers.depth.setTest(!0),ot.buffers.depth.setMask(!0),ot.buffers.color.setMask(!0),ot.setPolygonOffset(!1)}function Jo(w,U,B,H){if((B.isScene===!0?B.overrideMaterial:null)!==null)return;f.state.transmissionRenderTarget[H.id]===void 0&&(f.state.transmissionRenderTarget[H.id]=new rn(1,1,{generateMipmaps:!0,type:j.has("EXT_color_buffer_half_float")||j.has("EXT_color_buffer_float")?Is:Mi,minFilter:en,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Jt.workingColorSpace}));const rt=f.state.transmissionRenderTarget[H.id],xt=H.viewport||L;rt.setSize(xt.z,xt.w);const At=x.getRenderTarget();x.setRenderTarget(rt),x.getClearColor(G),q=x.getClearAlpha(),q<1&&x.setClearColor(16777215,.5),x.clear(),Q&&Ot.render(B);const Rt=x.toneMapping;x.toneMapping=ki;const Bt=H.viewport;if(H.viewport!==void 0&&(H.viewport=void 0),f.setupLightsView(H),nt===!0&&it.setGlobalState(x.clippingPlanes,H),Ns(w,B,H),E.updateMultisampleRenderTarget(rt),E.updateRenderTargetMipmap(rt),j.has("WEBGL_multisampled_render_to_texture")===!1){let Gt=!1;for(let Ct=0,Qt=U.length;Ct<Qt;Ct++){const le=U[Ct],ue=le.object,Fe=le.geometry,te=le.material,Pt=le.group;if(te.side===Re&&ue.layers.test(H.layers)){const di=te.side;te.side=De,te.needsUpdate=!0,Qo(ue,B,H,Fe,te,Pt),te.side=di,te.needsUpdate=!0,Gt=!0}}Gt===!0&&(E.updateMultisampleRenderTarget(rt),E.updateRenderTargetMipmap(rt))}x.setRenderTarget(At),x.setClearColor(G,q),Bt!==void 0&&(H.viewport=Bt),x.toneMapping=Rt}function Ns(w,U,B){const H=U.isScene===!0?U.overrideMaterial:null;for(let N=0,rt=w.length;N<rt;N++){const xt=w[N],At=xt.object,Rt=xt.geometry,Bt=H===null?xt.material:H,Gt=xt.group;At.layers.test(B.layers)&&Qo(At,U,B,Rt,Bt,Gt)}}function Qo(w,U,B,H,N,rt){w.onBeforeRender(x,U,B,H,N,rt),w.modelViewMatrix.multiplyMatrices(B.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),N.onBeforeRender(x,U,B,H,w,rt),N.transparent===!0&&N.side===Re&&N.forceSinglePass===!1?(N.side=De,N.needsUpdate=!0,x.renderBufferDirect(B,U,H,N,w,rt),N.side=Oi,N.needsUpdate=!0,x.renderBufferDirect(B,U,H,N,w,rt),N.side=Re):x.renderBufferDirect(B,U,H,N,w,rt),w.onAfterRender(x,U,B,H,N,rt)}function ks(w,U,B){U.isScene!==!0&&(U=qt);const H=mt.get(w),N=f.state.lights,rt=f.state.shadowsArray,xt=N.state.version,At=Et.getParameters(w,N.state,rt,U,B),Rt=Et.getProgramCacheKey(At);let Bt=H.programs;H.environment=w.isMeshStandardMaterial?U.environment:null,H.fog=U.fog,H.envMap=(w.isMeshStandardMaterial?z:b).get(w.envMap||H.environment),H.envMapRotation=H.environment!==null&&w.envMap===null?U.environmentRotation:w.envMapRotation,Bt===void 0&&(w.addEventListener("dispose",Ht),Bt=new Map,H.programs=Bt);let Gt=Bt.get(Rt);if(Gt!==void 0){if(H.currentProgram===Gt&&H.lightsStateVersion===xt)return el(w,At),Gt}else At.uniforms=Et.getUniforms(w),w.onBeforeCompile(At,x),Gt=Et.acquireProgram(At,Rt),Bt.set(Rt,Gt),H.uniforms=At.uniforms;const Ct=H.uniforms;return(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)&&(Ct.clippingPlanes=it.uniform),el(w,At),H.needsLights=Qh(w),H.lightsStateVersion=xt,H.needsLights&&(Ct.ambientLightColor.value=N.state.ambient,Ct.lightProbe.value=N.state.probe,Ct.directionalLights.value=N.state.directional,Ct.directionalLightShadows.value=N.state.directionalShadow,Ct.spotLights.value=N.state.spot,Ct.spotLightShadows.value=N.state.spotShadow,Ct.rectAreaLights.value=N.state.rectArea,Ct.ltc_1.value=N.state.rectAreaLTC1,Ct.ltc_2.value=N.state.rectAreaLTC2,Ct.pointLights.value=N.state.point,Ct.pointLightShadows.value=N.state.pointShadow,Ct.hemisphereLights.value=N.state.hemi,Ct.directionalShadowMap.value=N.state.directionalShadowMap,Ct.directionalShadowMatrix.value=N.state.directionalShadowMatrix,Ct.spotShadowMap.value=N.state.spotShadowMap,Ct.spotLightMatrix.value=N.state.spotLightMatrix,Ct.spotLightMap.value=N.state.spotLightMap,Ct.pointShadowMap.value=N.state.pointShadowMap,Ct.pointShadowMatrix.value=N.state.pointShadowMatrix),H.currentProgram=Gt,H.uniformsList=null,Gt}function tl(w){if(w.uniformsList===null){const U=w.currentProgram.getUniforms();w.uniformsList=Mr.seqWithValue(U.seq,w.uniforms)}return w.uniformsList}function el(w,U){const B=mt.get(w);B.outputColorSpace=U.outputColorSpace,B.batching=U.batching,B.batchingColor=U.batchingColor,B.instancing=U.instancing,B.instancingColor=U.instancingColor,B.instancingMorph=U.instancingMorph,B.skinning=U.skinning,B.morphTargets=U.morphTargets,B.morphNormals=U.morphNormals,B.morphColors=U.morphColors,B.morphTargetsCount=U.morphTargetsCount,B.numClippingPlanes=U.numClippingPlanes,B.numIntersection=U.numClipIntersection,B.vertexAlphas=U.vertexAlphas,B.vertexTangents=U.vertexTangents,B.toneMapping=U.toneMapping}function Zh(w,U,B,H,N){U.isScene!==!0&&(U=qt),E.resetTextureUnits();const rt=U.fog,xt=H.isMeshStandardMaterial?U.environment:null,At=P===null?x.outputColorSpace:P.isXRRenderTarget===!0?P.texture.colorSpace:Kn,Rt=(H.isMeshStandardMaterial?z:b).get(H.envMap||xt),Bt=H.vertexColors===!0&&!!B.attributes.color&&B.attributes.color.itemSize===4,Gt=!!B.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),Ct=!!B.morphAttributes.position,Qt=!!B.morphAttributes.normal,le=!!B.morphAttributes.color;let ue=ki;H.toneMapped&&(P===null||P.isXRRenderTarget===!0)&&(ue=x.toneMapping);const Fe=B.morphAttributes.position||B.morphAttributes.normal||B.morphAttributes.color,te=Fe!==void 0?Fe.length:0,Pt=mt.get(H),di=f.state.lights;if(nt===!0&&(St===!0||w!==_)){const qe=w===_&&H.id===S;it.setState(H,w,qe)}let ee=!1;H.version===Pt.__version?(Pt.needsLights&&Pt.lightsStateVersion!==di.state.version||Pt.outputColorSpace!==At||N.isBatchedMesh&&Pt.batching===!1||!N.isBatchedMesh&&Pt.batching===!0||N.isBatchedMesh&&Pt.batchingColor===!0&&N.colorTexture===null||N.isBatchedMesh&&Pt.batchingColor===!1&&N.colorTexture!==null||N.isInstancedMesh&&Pt.instancing===!1||!N.isInstancedMesh&&Pt.instancing===!0||N.isSkinnedMesh&&Pt.skinning===!1||!N.isSkinnedMesh&&Pt.skinning===!0||N.isInstancedMesh&&Pt.instancingColor===!0&&N.instanceColor===null||N.isInstancedMesh&&Pt.instancingColor===!1&&N.instanceColor!==null||N.isInstancedMesh&&Pt.instancingMorph===!0&&N.morphTexture===null||N.isInstancedMesh&&Pt.instancingMorph===!1&&N.morphTexture!==null||Pt.envMap!==Rt||H.fog===!0&&Pt.fog!==rt||Pt.numClippingPlanes!==void 0&&(Pt.numClippingPlanes!==it.numPlanes||Pt.numIntersection!==it.numIntersection)||Pt.vertexAlphas!==Bt||Pt.vertexTangents!==Gt||Pt.morphTargets!==Ct||Pt.morphNormals!==Qt||Pt.morphColors!==le||Pt.toneMapping!==ue||Pt.morphTargetsCount!==te)&&(ee=!0):(ee=!0,Pt.__version=H.version);let Je=Pt.currentProgram;ee===!0&&(Je=ks(H,U,N));let fn=!1,Be=!1,Qn=!1;const de=Je.getUniforms(),ri=Pt.uniforms;if(ot.useProgram(Je.program)&&(fn=!0,Be=!0,Qn=!0),H.id!==S&&(S=H.id,Be=!0),fn||_!==w){ot.buffers.depth.getReversed()?(at.copy(w.projectionMatrix),sd(at),rd(at),de.setValue(T,"projectionMatrix",at)):de.setValue(T,"projectionMatrix",w.projectionMatrix),de.setValue(T,"viewMatrix",w.matrixWorldInverse);const wi=de.map.cameraPosition;wi!==void 0&&wi.setValue(T,kt.setFromMatrixPosition(w.matrixWorld)),ut.logarithmicDepthBuffer&&de.setValue(T,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2)),(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)&&de.setValue(T,"isOrthographic",w.isOrthographicCamera===!0),_!==w&&(_=w,Be=!0,Qn=!0)}if(N.isSkinnedMesh){de.setOptional(T,N,"bindMatrix"),de.setOptional(T,N,"bindMatrixInverse");const qe=N.skeleton;qe&&(qe.boneTexture===null&&qe.computeBoneTexture(),de.setValue(T,"boneTexture",qe.boneTexture,E))}N.isBatchedMesh&&(de.setOptional(T,N,"batchingTexture"),de.setValue(T,"batchingTexture",N._matricesTexture,E),de.setOptional(T,N,"batchingIdTexture"),de.setValue(T,"batchingIdTexture",N._indirectTexture,E),de.setOptional(T,N,"batchingColorTexture"),N._colorsTexture!==null&&de.setValue(T,"batchingColorTexture",N._colorsTexture,E));const ts=B.morphAttributes;if((ts.position!==void 0||ts.normal!==void 0||ts.color!==void 0)&&Ft.update(N,B,Je),(Be||Pt.receiveShadow!==N.receiveShadow)&&(Pt.receiveShadow=N.receiveShadow,de.setValue(T,"receiveShadow",N.receiveShadow)),H.isMeshGouraudMaterial&&H.envMap!==null&&(ri.envMap.value=Rt,ri.flipEnvMap.value=Rt.isCubeTexture&&Rt.isRenderTargetTexture===!1?-1:1),H.isMeshStandardMaterial&&H.envMap===null&&U.environment!==null&&(ri.envMapIntensity.value=U.environmentIntensity),Be&&(de.setValue(T,"toneMappingExposure",x.toneMappingExposure),Pt.needsLights&&Jh(ri,Qn),rt&&H.fog===!0&&ft.refreshFogUniforms(ri,rt),ft.refreshMaterialUniforms(ri,H,V,Z,f.state.transmissionRenderTarget[w.id]),Mr.upload(T,tl(Pt),ri,E)),H.isShaderMaterial&&H.uniformsNeedUpdate===!0&&(Mr.upload(T,tl(Pt),ri,E),H.uniformsNeedUpdate=!1),H.isSpriteMaterial&&de.setValue(T,"center",N.center),de.setValue(T,"modelViewMatrix",N.modelViewMatrix),de.setValue(T,"normalMatrix",N.normalMatrix),de.setValue(T,"modelMatrix",N.matrixWorld),H.isShaderMaterial||H.isRawShaderMaterial){const qe=H.uniformsGroups;for(let wi=0,Ei=qe.length;wi<Ei;wi++){const il=qe[wi];D.update(il,Je),D.bind(il,Je)}}return Je}function Jh(w,U){w.ambientLightColor.needsUpdate=U,w.lightProbe.needsUpdate=U,w.directionalLights.needsUpdate=U,w.directionalLightShadows.needsUpdate=U,w.pointLights.needsUpdate=U,w.pointLightShadows.needsUpdate=U,w.spotLights.needsUpdate=U,w.spotLightShadows.needsUpdate=U,w.rectAreaLights.needsUpdate=U,w.hemisphereLights.needsUpdate=U}function Qh(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return A},this.getActiveMipmapLevel=function(){return C},this.getRenderTarget=function(){return P},this.setRenderTargetTextures=function(w,U,B){mt.get(w.texture).__webglTexture=U,mt.get(w.depthTexture).__webglTexture=B;const H=mt.get(w);H.__hasExternalTextures=!0,H.__autoAllocateDepthBuffer=B===void 0,H.__autoAllocateDepthBuffer||j.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),H.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(w,U){const B=mt.get(w);B.__webglFramebuffer=U,B.__useDefaultFramebuffer=U===void 0},this.setRenderTarget=function(w,U=0,B=0){P=w,A=U,C=B;let H=!0,N=null,rt=!1,xt=!1;if(w){const Rt=mt.get(w);if(Rt.__useDefaultFramebuffer!==void 0)ot.bindFramebuffer(T.FRAMEBUFFER,null),H=!1;else if(Rt.__webglFramebuffer===void 0)E.setupRenderTarget(w);else if(Rt.__hasExternalTextures)E.rebindTextures(w,mt.get(w.texture).__webglTexture,mt.get(w.depthTexture).__webglTexture);else if(w.depthBuffer){const Ct=w.depthTexture;if(Rt.__boundDepthTexture!==Ct){if(Ct!==null&&mt.has(Ct)&&(w.width!==Ct.image.width||w.height!==Ct.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");E.setupDepthRenderbuffer(w)}}const Bt=w.texture;(Bt.isData3DTexture||Bt.isDataArrayTexture||Bt.isCompressedArrayTexture)&&(xt=!0);const Gt=mt.get(w).__webglFramebuffer;w.isWebGLCubeRenderTarget?(Array.isArray(Gt[U])?N=Gt[U][B]:N=Gt[U],rt=!0):w.samples>0&&E.useMultisampledRTT(w)===!1?N=mt.get(w).__webglMultisampledFramebuffer:Array.isArray(Gt)?N=Gt[B]:N=Gt,L.copy(w.viewport),O.copy(w.scissor),F=w.scissorTest}else L.copy(Mt).multiplyScalar(V).floor(),O.copy(zt).multiplyScalar(V).floor(),F=jt;if(ot.bindFramebuffer(T.FRAMEBUFFER,N)&&H&&ot.drawBuffers(w,N),ot.viewport(L),ot.scissor(O),ot.setScissorTest(F),rt){const Rt=mt.get(w.texture);T.framebufferTexture2D(T.FRAMEBUFFER,T.COLOR_ATTACHMENT0,T.TEXTURE_CUBE_MAP_POSITIVE_X+U,Rt.__webglTexture,B)}else if(xt){const Rt=mt.get(w.texture),Bt=U||0;T.framebufferTextureLayer(T.FRAMEBUFFER,T.COLOR_ATTACHMENT0,Rt.__webglTexture,B||0,Bt)}S=-1},this.readRenderTargetPixels=function(w,U,B,H,N,rt,xt){if(!(w&&w.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let At=mt.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&xt!==void 0&&(At=At[xt]),At){ot.bindFramebuffer(T.FRAMEBUFFER,At);try{const Rt=w.texture,Bt=Rt.format,Gt=Rt.type;if(!ut.textureFormatReadable(Bt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!ut.textureTypeReadable(Gt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}U>=0&&U<=w.width-H&&B>=0&&B<=w.height-N&&T.readPixels(U,B,H,N,Wt.convert(Bt),Wt.convert(Gt),rt)}finally{const Rt=P!==null?mt.get(P).__webglFramebuffer:null;ot.bindFramebuffer(T.FRAMEBUFFER,Rt)}}},this.readRenderTargetPixelsAsync=async function(w,U,B,H,N,rt,xt){if(!(w&&w.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let At=mt.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&xt!==void 0&&(At=At[xt]),At){const Rt=w.texture,Bt=Rt.format,Gt=Rt.type;if(!ut.textureFormatReadable(Bt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!ut.textureTypeReadable(Gt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(U>=0&&U<=w.width-H&&B>=0&&B<=w.height-N){ot.bindFramebuffer(T.FRAMEBUFFER,At);const Ct=T.createBuffer();T.bindBuffer(T.PIXEL_PACK_BUFFER,Ct),T.bufferData(T.PIXEL_PACK_BUFFER,rt.byteLength,T.STREAM_READ),T.readPixels(U,B,H,N,Wt.convert(Bt),Wt.convert(Gt),0);const Qt=P!==null?mt.get(P).__webglFramebuffer:null;ot.bindFramebuffer(T.FRAMEBUFFER,Qt);const le=T.fenceSync(T.SYNC_GPU_COMMANDS_COMPLETE,0);return T.flush(),await nd(T,le,4),T.bindBuffer(T.PIXEL_PACK_BUFFER,Ct),T.getBufferSubData(T.PIXEL_PACK_BUFFER,0,rt),T.deleteBuffer(Ct),T.deleteSync(le),rt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(w,U=null,B=0){w.isTexture!==!0&&(us("WebGLRenderer: copyFramebufferToTexture function signature has changed."),U=arguments[0]||null,w=arguments[1]);const H=Math.pow(2,-B),N=Math.floor(w.image.width*H),rt=Math.floor(w.image.height*H),xt=U!==null?U.x:0,At=U!==null?U.y:0;E.setTexture2D(w,0),T.copyTexSubImage2D(T.TEXTURE_2D,B,0,0,xt,At,N,rt),ot.unbindTexture()},this.copyTextureToTexture=function(w,U,B=null,H=null,N=0){w.isTexture!==!0&&(us("WebGLRenderer: copyTextureToTexture function signature has changed."),H=arguments[0]||null,w=arguments[1],U=arguments[2],N=arguments[3]||0,B=null);let rt,xt,At,Rt,Bt,Gt,Ct,Qt,le;const ue=w.isCompressedTexture?w.mipmaps[N]:w.image;B!==null?(rt=B.max.x-B.min.x,xt=B.max.y-B.min.y,At=B.isBox3?B.max.z-B.min.z:1,Rt=B.min.x,Bt=B.min.y,Gt=B.isBox3?B.min.z:0):(rt=ue.width,xt=ue.height,At=ue.depth||1,Rt=0,Bt=0,Gt=0),H!==null?(Ct=H.x,Qt=H.y,le=H.z):(Ct=0,Qt=0,le=0);const Fe=Wt.convert(U.format),te=Wt.convert(U.type);let Pt;U.isData3DTexture?(E.setTexture3D(U,0),Pt=T.TEXTURE_3D):U.isDataArrayTexture||U.isCompressedArrayTexture?(E.setTexture2DArray(U,0),Pt=T.TEXTURE_2D_ARRAY):(E.setTexture2D(U,0),Pt=T.TEXTURE_2D),T.pixelStorei(T.UNPACK_FLIP_Y_WEBGL,U.flipY),T.pixelStorei(T.UNPACK_PREMULTIPLY_ALPHA_WEBGL,U.premultiplyAlpha),T.pixelStorei(T.UNPACK_ALIGNMENT,U.unpackAlignment);const di=T.getParameter(T.UNPACK_ROW_LENGTH),ee=T.getParameter(T.UNPACK_IMAGE_HEIGHT),Je=T.getParameter(T.UNPACK_SKIP_PIXELS),fn=T.getParameter(T.UNPACK_SKIP_ROWS),Be=T.getParameter(T.UNPACK_SKIP_IMAGES);T.pixelStorei(T.UNPACK_ROW_LENGTH,ue.width),T.pixelStorei(T.UNPACK_IMAGE_HEIGHT,ue.height),T.pixelStorei(T.UNPACK_SKIP_PIXELS,Rt),T.pixelStorei(T.UNPACK_SKIP_ROWS,Bt),T.pixelStorei(T.UNPACK_SKIP_IMAGES,Gt);const Qn=w.isDataArrayTexture||w.isData3DTexture,de=U.isDataArrayTexture||U.isData3DTexture;if(w.isRenderTargetTexture||w.isDepthTexture){const ri=mt.get(w),ts=mt.get(U),qe=mt.get(ri.__renderTarget),wi=mt.get(ts.__renderTarget);ot.bindFramebuffer(T.READ_FRAMEBUFFER,qe.__webglFramebuffer),ot.bindFramebuffer(T.DRAW_FRAMEBUFFER,wi.__webglFramebuffer);for(let Ei=0;Ei<At;Ei++)Qn&&T.framebufferTextureLayer(T.READ_FRAMEBUFFER,T.COLOR_ATTACHMENT0,mt.get(w).__webglTexture,N,Gt+Ei),w.isDepthTexture?(de&&T.framebufferTextureLayer(T.DRAW_FRAMEBUFFER,T.COLOR_ATTACHMENT0,mt.get(U).__webglTexture,N,le+Ei),T.blitFramebuffer(Rt,Bt,rt,xt,Ct,Qt,rt,xt,T.DEPTH_BUFFER_BIT,T.NEAREST)):de?T.copyTexSubImage3D(Pt,N,Ct,Qt,le+Ei,Rt,Bt,rt,xt):T.copyTexSubImage2D(Pt,N,Ct,Qt,le+Ei,Rt,Bt,rt,xt);ot.bindFramebuffer(T.READ_FRAMEBUFFER,null),ot.bindFramebuffer(T.DRAW_FRAMEBUFFER,null)}else de?w.isDataTexture||w.isData3DTexture?T.texSubImage3D(Pt,N,Ct,Qt,le,rt,xt,At,Fe,te,ue.data):U.isCompressedArrayTexture?T.compressedTexSubImage3D(Pt,N,Ct,Qt,le,rt,xt,At,Fe,ue.data):T.texSubImage3D(Pt,N,Ct,Qt,le,rt,xt,At,Fe,te,ue):w.isDataTexture?T.texSubImage2D(T.TEXTURE_2D,N,Ct,Qt,rt,xt,Fe,te,ue.data):w.isCompressedTexture?T.compressedTexSubImage2D(T.TEXTURE_2D,N,Ct,Qt,ue.width,ue.height,Fe,ue.data):T.texSubImage2D(T.TEXTURE_2D,N,Ct,Qt,rt,xt,Fe,te,ue);T.pixelStorei(T.UNPACK_ROW_LENGTH,di),T.pixelStorei(T.UNPACK_IMAGE_HEIGHT,ee),T.pixelStorei(T.UNPACK_SKIP_PIXELS,Je),T.pixelStorei(T.UNPACK_SKIP_ROWS,fn),T.pixelStorei(T.UNPACK_SKIP_IMAGES,Be),N===0&&U.generateMipmaps&&T.generateMipmap(Pt),ot.unbindTexture()},this.copyTextureToTexture3D=function(w,U,B=null,H=null,N=0){return w.isTexture!==!0&&(us("WebGLRenderer: copyTextureToTexture3D function signature has changed."),B=arguments[0]||null,H=arguments[1]||null,w=arguments[2],U=arguments[3],N=arguments[4]||0),us('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(w,U,B,H,N)},this.initRenderTarget=function(w){mt.get(w).__webglFramebuffer===void 0&&E.setupRenderTarget(w)},this.initTexture=function(w){w.isCubeTexture?E.setTextureCube(w,0):w.isData3DTexture?E.setTexture3D(w,0):w.isDataArrayTexture||w.isCompressedArrayTexture?E.setTexture2DArray(w,0):E.setTexture2D(w,0),ot.unbindTexture()},this.resetState=function(){A=0,C=0,P=null,ot.reset(),oe.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return _i}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorspace=Jt._getDrawingBufferColorSpace(t),e.unpackColorSpace=Jt._getUnpackColorSpace()}}class Zn{constructor(t,e=25e-5){this.isFogExp2=!0,this.name="",this.color=new Ut(t),this.density=e}clone(){return new Zn(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}}class gg extends xe{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new ci,this.environmentIntensity=1,this.environmentRotation=new ci,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}}class fh extends Ue{constructor(t=null,e=1,i=1,n,r,a,o,l,c=Oe,h=Oe,u,d){super(null,a,o,l,c,h,n,r,u,d),this.isDataTexture=!0,this.image={data:t,width:e,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class ec extends Ae{constructor(t,e,i,n=1){super(t,e,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=n}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const Rn=new se,ic=new se,sr=[],nc=new un,vg=new se,rs=new gt,as=new dn;class xg extends gt{constructor(t,e,i){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new ec(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let n=0;n<i;n++)this.setMatrixAt(n,vg)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new un),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<e;i++)this.getMatrixAt(i,Rn),nc.copy(t.boundingBox).applyMatrix4(Rn),this.boundingBox.union(nc)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new dn),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<e;i++)this.getMatrixAt(i,Rn),as.copy(t.boundingSphere).applyMatrix4(Rn),this.boundingSphere.union(as)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){const i=e.morphTargetInfluences,n=this.morphTexture.source.data.data,r=i.length+1,a=t*r+1;for(let o=0;o<i.length;o++)i[o]=n[a+o]}raycast(t,e){const i=this.matrixWorld,n=this.count;if(rs.geometry=this.geometry,rs.material=this.material,rs.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),as.copy(this.boundingSphere),as.applyMatrix4(i),t.ray.intersectsSphere(as)!==!1))for(let r=0;r<n;r++){this.getMatrixAt(r,Rn),ic.multiplyMatrices(i,Rn),rs.matrixWorld=ic,rs.raycast(t,sr);for(let a=0,o=sr.length;a<o;a++){const l=sr[a];l.instanceId=r,l.object=this,e.push(l)}sr.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new ec(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}setMorphAt(t,e){const i=e.morphTargetInfluences,n=i.length+1;this.morphTexture===null&&(this.morphTexture=new fh(new Float32Array(n*this.count),n,this.count,Io,li));const r=this.morphTexture.source.data.data;let a=0;for(let c=0;c<i.length;c++)a+=i[c];const o=this.geometry.morphTargetsRelative?1:1-a,l=n*t;r[l]=o,r.set(i,l+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}}class ph extends Bi{static get type(){return"LineBasicMaterial"}constructor(t){super(),this.isLineBasicMaterial=!0,this.color=new Ut(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}}const Tr=new R,Ar=new R,sc=new se,os=new Fo,rr=new dn,ya=new R,rc=new R;class _g extends xe{constructor(t=new ye,e=new ph){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,i=[0];for(let n=1,r=e.count;n<r;n++)Tr.fromBufferAttribute(e,n-1),Ar.fromBufferAttribute(e,n),i[n]=i[n-1],i[n]+=Tr.distanceTo(Ar);t.setAttribute("lineDistance",new $t(i,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,e){const i=this.geometry,n=this.matrixWorld,r=t.params.Line.threshold,a=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),rr.copy(i.boundingSphere),rr.applyMatrix4(n),rr.radius+=r,t.ray.intersectsSphere(rr)===!1)return;sc.copy(n).invert(),os.copy(t.ray).applyMatrix4(sc);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,h=i.index,d=i.attributes.position;if(h!==null){const p=Math.max(0,a.start),g=Math.min(h.count,a.start+a.count);for(let v=p,m=g-1;v<m;v+=c){const f=h.getX(v),M=h.getX(v+1),y=ar(this,t,os,l,f,M);y&&e.push(y)}if(this.isLineLoop){const v=h.getX(g-1),m=h.getX(p),f=ar(this,t,os,l,v,m);f&&e.push(f)}}else{const p=Math.max(0,a.start),g=Math.min(d.count,a.start+a.count);for(let v=p,m=g-1;v<m;v+=c){const f=ar(this,t,os,l,v,v+1);f&&e.push(f)}if(this.isLineLoop){const v=ar(this,t,os,l,g-1,p);v&&e.push(v)}}}updateMorphTargets(){const e=this.geometry.morphAttributes,i=Object.keys(e);if(i.length>0){const n=e[i[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=n.length;r<a;r++){const o=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function ar(s,t,e,i,n,r){const a=s.geometry.attributes.position;if(Tr.fromBufferAttribute(a,n),Ar.fromBufferAttribute(a,r),e.distanceSqToSegment(Tr,Ar,ya,rc)>i)return;ya.applyMatrix4(s.matrixWorld);const l=t.ray.origin.distanceTo(ya);if(!(l<t.near||l>t.far))return{distance:l,point:rc.clone().applyMatrix4(s.matrixWorld),index:n,face:null,faceIndex:null,barycoord:null,object:s}}const ac=new R,oc=new R;class yg extends _g{constructor(t,e){super(t,e),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,i=[];for(let n=0,r=e.count;n<r;n+=2)ac.fromBufferAttribute(e,n),oc.fromBufferAttribute(e,n+1),i[n]=n===0?0:i[n-1],i[n+1]=i[n]+ac.distanceTo(oc);t.setAttribute("lineDistance",new $t(i,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class Mg extends Bi{static get type(){return"PointsMaterial"}constructor(t){super(),this.isPointsMaterial=!0,this.color=new Ut(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}const lc=new se,vo=new Fo,or=new dn,lr=new R;class Sg extends xe{constructor(t=new ye,e=new Mg){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){const i=this.geometry,n=this.matrixWorld,r=t.params.Points.threshold,a=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),or.copy(i.boundingSphere),or.applyMatrix4(n),or.radius+=r,t.ray.intersectsSphere(or)===!1)return;lc.copy(n).invert(),vo.copy(t.ray).applyMatrix4(lc);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=i.index,u=i.attributes.position;if(c!==null){const d=Math.max(0,a.start),p=Math.min(c.count,a.start+a.count);for(let g=d,v=p;g<v;g++){const m=c.getX(g);lr.fromBufferAttribute(u,m),cc(lr,m,l,n,t,e,this)}}else{const d=Math.max(0,a.start),p=Math.min(u.count,a.start+a.count);for(let g=d,v=p;g<v;g++)lr.fromBufferAttribute(u,g),cc(lr,g,l,n,t,e,this)}}updateMorphTargets(){const e=this.geometry.morphAttributes,i=Object.keys(e);if(i.length>0){const n=e[i[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=n.length;r<a;r++){const o=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function cc(s,t,e,i,n,r,a){const o=vo.distanceSqToPoint(s);if(o<e){const l=new R;vo.closestPointToPoint(s,l),l.applyMatrix4(i);const c=n.ray.origin.distanceTo(l);if(c<n.near||c>n.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:a})}}class bg extends Ue{constructor(t,e,i,n,r,a,o,l,c){super(t,e,i,n,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class hi{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(t,e){const i=this.getUtoTmapping(t);return this.getPoint(i,e)}getPoints(t=5){const e=[];for(let i=0;i<=t;i++)e.push(this.getPoint(i/t));return e}getSpacedPoints(t=5){const e=[];for(let i=0;i<=t;i++)e.push(this.getPointAt(i/t));return e}getLength(){const t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const e=[];let i,n=this.getPoint(0),r=0;e.push(0);for(let a=1;a<=t;a++)i=this.getPoint(a/t),r+=i.distanceTo(n),e.push(r),n=i;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e){const i=this.getLengths();let n=0;const r=i.length;let a;e?a=e:a=t*i[r-1];let o=0,l=r-1,c;for(;o<=l;)if(n=Math.floor(o+(l-o)/2),c=i[n]-a,c<0)o=n+1;else if(c>0)l=n-1;else{l=n;break}if(n=l,i[n]===a)return n/(r-1);const h=i[n],d=i[n+1]-h,p=(a-h)/d;return(n+p)/(r-1)}getTangent(t,e){let n=t-1e-4,r=t+1e-4;n<0&&(n=0),r>1&&(r=1);const a=this.getPoint(n),o=this.getPoint(r),l=e||(a.isVector2?new lt:new R);return l.copy(o).sub(a).normalize(),l}getTangentAt(t,e){const i=this.getUtoTmapping(t);return this.getTangent(i,e)}computeFrenetFrames(t,e){const i=new R,n=[],r=[],a=[],o=new R,l=new se;for(let p=0;p<=t;p++){const g=p/t;n[p]=this.getTangentAt(g,new R)}r[0]=new R,a[0]=new R;let c=Number.MAX_VALUE;const h=Math.abs(n[0].x),u=Math.abs(n[0].y),d=Math.abs(n[0].z);h<=c&&(c=h,i.set(1,0,0)),u<=c&&(c=u,i.set(0,1,0)),d<=c&&i.set(0,0,1),o.crossVectors(n[0],i).normalize(),r[0].crossVectors(n[0],o),a[0].crossVectors(n[0],r[0]);for(let p=1;p<=t;p++){if(r[p]=r[p-1].clone(),a[p]=a[p-1].clone(),o.crossVectors(n[p-1],n[p]),o.length()>Number.EPSILON){o.normalize();const g=Math.acos(Te(n[p-1].dot(n[p]),-1,1));r[p].applyMatrix4(l.makeRotationAxis(o,g))}a[p].crossVectors(n[p],r[p])}if(e===!0){let p=Math.acos(Te(r[0].dot(r[t]),-1,1));p/=t,n[0].dot(o.crossVectors(r[0],r[t]))>0&&(p=-p);for(let g=1;g<=t;g++)r[g].applyMatrix4(l.makeRotationAxis(n[g],p*g)),a[g].crossVectors(n[g],r[g])}return{tangents:n,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){const t={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}}class Ho extends hi{constructor(t=0,e=0,i=1,n=1,r=0,a=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=i,this.yRadius=n,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(t,e=new lt){const i=e,n=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=n;for(;r>n;)r-=n;r<Number.EPSILON&&(a?r=0:r=n),this.aClockwise===!0&&!a&&(r===n?r=-n:r=r-n);const o=this.aStartAngle+t*r;let l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){const h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=l-this.aX,p=c-this.aY;l=d*h-p*u+this.aX,c=d*u+p*h+this.aY}return i.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){const t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}}class wg extends Ho{constructor(t,e,i,n,r,a){super(t,e,i,i,n,r,a),this.isArcCurve=!0,this.type="ArcCurve"}}function Go(){let s=0,t=0,e=0,i=0;function n(r,a,o,l){s=r,t=o,e=-3*r+3*a-2*o-l,i=2*r-2*a+o+l}return{initCatmullRom:function(r,a,o,l,c){n(a,o,c*(o-r),c*(l-a))},initNonuniformCatmullRom:function(r,a,o,l,c,h,u){let d=(a-r)/c-(o-r)/(c+h)+(o-a)/h,p=(o-a)/h-(l-a)/(h+u)+(l-o)/u;d*=h,p*=h,n(a,o,d,p)},calc:function(r){const a=r*r,o=a*r;return s+t*r+e*a+i*o}}}const cr=new R,Ma=new Go,Sa=new Go,ba=new Go;class mh extends hi{constructor(t=[],e=!1,i="centripetal",n=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=i,this.tension=n}getPoint(t,e=new R){const i=e,n=this.points,r=n.length,a=(r-(this.closed?0:1))*t;let o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:l===0&&o===r-1&&(o=r-2,l=1);let c,h;this.closed||o>0?c=n[(o-1)%r]:(cr.subVectors(n[0],n[1]).add(n[0]),c=cr);const u=n[o%r],d=n[(o+1)%r];if(this.closed||o+2<r?h=n[(o+2)%r]:(cr.subVectors(n[r-1],n[r-2]).add(n[r-1]),h=cr),this.curveType==="centripetal"||this.curveType==="chordal"){const p=this.curveType==="chordal"?.5:.25;let g=Math.pow(c.distanceToSquared(u),p),v=Math.pow(u.distanceToSquared(d),p),m=Math.pow(d.distanceToSquared(h),p);v<1e-4&&(v=1),g<1e-4&&(g=v),m<1e-4&&(m=v),Ma.initNonuniformCatmullRom(c.x,u.x,d.x,h.x,g,v,m),Sa.initNonuniformCatmullRom(c.y,u.y,d.y,h.y,g,v,m),ba.initNonuniformCatmullRom(c.z,u.z,d.z,h.z,g,v,m)}else this.curveType==="catmullrom"&&(Ma.initCatmullRom(c.x,u.x,d.x,h.x,this.tension),Sa.initCatmullRom(c.y,u.y,d.y,h.y,this.tension),ba.initCatmullRom(c.z,u.z,d.z,h.z,this.tension));return i.set(Ma.calc(l),Sa.calc(l),ba.calc(l)),i}copy(t){super.copy(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){const n=t.points[e];this.points.push(n.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,i=this.points.length;e<i;e++){const n=this.points[e];t.points.push(n.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){const n=t.points[e];this.points.push(new R().fromArray(n))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}}function hc(s,t,e,i,n){const r=(i-t)*.5,a=(n-e)*.5,o=s*s,l=s*o;return(2*e-2*i+r+a)*l+(-3*e+3*i-2*r-a)*o+r*s+e}function Eg(s,t){const e=1-s;return e*e*t}function Tg(s,t){return 2*(1-s)*s*t}function Ag(s,t){return s*s*t}function ms(s,t,e,i){return Eg(s,t)+Tg(s,e)+Ag(s,i)}function Rg(s,t){const e=1-s;return e*e*e*t}function Cg(s,t){const e=1-s;return 3*e*e*s*t}function Lg(s,t){return 3*(1-s)*s*s*t}function Pg(s,t){return s*s*s*t}function gs(s,t,e,i,n){return Rg(s,t)+Cg(s,e)+Lg(s,i)+Pg(s,n)}class gh extends hi{constructor(t=new lt,e=new lt,i=new lt,n=new lt){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=i,this.v3=n}getPoint(t,e=new lt){const i=e,n=this.v0,r=this.v1,a=this.v2,o=this.v3;return i.set(gs(t,n.x,r.x,a.x,o.x),gs(t,n.y,r.y,a.y,o.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class Ig extends hi{constructor(t=new R,e=new R,i=new R,n=new R){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=i,this.v3=n}getPoint(t,e=new R){const i=e,n=this.v0,r=this.v1,a=this.v2,o=this.v3;return i.set(gs(t,n.x,r.x,a.x,o.x),gs(t,n.y,r.y,a.y,o.y),gs(t,n.z,r.z,a.z,o.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class vh extends hi{constructor(t=new lt,e=new lt){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new lt){const i=e;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new lt){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Dg extends hi{constructor(t=new R,e=new R){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new R){const i=e;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new R){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class xh extends hi{constructor(t=new lt,e=new lt,i=new lt){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=i}getPoint(t,e=new lt){const i=e,n=this.v0,r=this.v1,a=this.v2;return i.set(ms(t,n.x,r.x,a.x),ms(t,n.y,r.y,a.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Ug extends hi{constructor(t=new R,e=new R,i=new R){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=i}getPoint(t,e=new R){const i=e,n=this.v0,r=this.v1,a=this.v2;return i.set(ms(t,n.x,r.x,a.x),ms(t,n.y,r.y,a.y),ms(t,n.z,r.z,a.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class _h extends hi{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new lt){const i=e,n=this.points,r=(n.length-1)*t,a=Math.floor(r),o=r-a,l=n[a===0?a:a-1],c=n[a],h=n[a>n.length-2?n.length-1:a+1],u=n[a>n.length-3?n.length-1:a+2];return i.set(hc(o,l.x,c.x,h.x,u.x),hc(o,l.y,c.y,h.y,u.y)),i}copy(t){super.copy(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){const n=t.points[e];this.points.push(n.clone())}return this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,i=this.points.length;e<i;e++){const n=this.points[e];t.points.push(n.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){const n=t.points[e];this.points.push(new lt().fromArray(n))}return this}}var xo=Object.freeze({__proto__:null,ArcCurve:wg,CatmullRomCurve3:mh,CubicBezierCurve:gh,CubicBezierCurve3:Ig,EllipseCurve:Ho,LineCurve:vh,LineCurve3:Dg,QuadraticBezierCurve:xh,QuadraticBezierCurve3:Ug,SplineCurve:_h});class Ng extends hi{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){const t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){const i=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new xo[i](e,t))}return this}getPoint(t,e){const i=t*this.getLength(),n=this.getCurveLengths();let r=0;for(;r<n.length;){if(n[r]>=i){const a=n[r]-i,o=this.curves[r],l=o.getLength(),c=l===0?0:1-a/l;return o.getPointAt(c,e)}r++}return null}getLength(){const t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const t=[];let e=0;for(let i=0,n=this.curves.length;i<n;i++)e+=this.curves[i].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){const e=[];for(let i=0;i<=t;i++)e.push(this.getPoint(i/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){const e=[];let i;for(let n=0,r=this.curves;n<r.length;n++){const a=r[n],o=a.isEllipseCurve?t*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?t*a.points.length:t,l=a.getPoints(o);for(let c=0;c<l.length;c++){const h=l[c];i&&i.equals(h)||(e.push(h),i=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,i=t.curves.length;e<i;e++){const n=t.curves[e];this.curves.push(n.clone())}return this.autoClose=t.autoClose,this}toJSON(){const t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,i=this.curves.length;e<i;e++){const n=this.curves[e];t.curves.push(n.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,i=t.curves.length;e<i;e++){const n=t.curves[e];this.curves.push(new xo[n.type]().fromJSON(n))}return this}}class _o extends Ng{constructor(t){super(),this.type="Path",this.currentPoint=new lt,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,i=t.length;e<i;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){const i=new vh(this.currentPoint.clone(),new lt(t,e));return this.curves.push(i),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,i,n){const r=new xh(this.currentPoint.clone(),new lt(t,e),new lt(i,n));return this.curves.push(r),this.currentPoint.set(i,n),this}bezierCurveTo(t,e,i,n,r,a){const o=new gh(this.currentPoint.clone(),new lt(t,e),new lt(i,n),new lt(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(t){const e=[this.currentPoint.clone()].concat(t),i=new _h(e);return this.curves.push(i),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,i,n,r,a){const o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+o,e+l,i,n,r,a),this}absarc(t,e,i,n,r,a){return this.absellipse(t,e,i,i,n,r,a),this}ellipse(t,e,i,n,r,a,o,l){const c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,i,n,r,a,o,l),this}absellipse(t,e,i,n,r,a,o,l){const c=new Ho(t,e,i,n,r,a,o,l);if(this.curves.length>0){const u=c.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(c);const h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){const t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}}class Nr extends ye{constructor(t=[new lt(0,-.5),new lt(.5,0),new lt(0,.5)],e=12,i=0,n=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:t,segments:e,phiStart:i,phiLength:n},e=Math.floor(e),n=Te(n,0,Math.PI*2);const r=[],a=[],o=[],l=[],c=[],h=1/e,u=new R,d=new lt,p=new R,g=new R,v=new R;let m=0,f=0;for(let M=0;M<=t.length-1;M++)switch(M){case 0:m=t[M+1].x-t[M].x,f=t[M+1].y-t[M].y,p.x=f*1,p.y=-m,p.z=f*0,v.copy(p),p.normalize(),l.push(p.x,p.y,p.z);break;case t.length-1:l.push(v.x,v.y,v.z);break;default:m=t[M+1].x-t[M].x,f=t[M+1].y-t[M].y,p.x=f*1,p.y=-m,p.z=f*0,g.copy(p),p.x+=v.x,p.y+=v.y,p.z+=v.z,p.normalize(),l.push(p.x,p.y,p.z),v.copy(g)}for(let M=0;M<=e;M++){const y=i+M*h*n,x=Math.sin(y),I=Math.cos(y);for(let A=0;A<=t.length-1;A++){u.x=t[A].x*x,u.y=t[A].y,u.z=t[A].x*I,a.push(u.x,u.y,u.z),d.x=M/e,d.y=A/(t.length-1),o.push(d.x,d.y);const C=l[3*A+0]*x,P=l[3*A+1],S=l[3*A+0]*I;c.push(C,P,S)}}for(let M=0;M<e;M++)for(let y=0;y<t.length-1;y++){const x=y+M*t.length,I=x,A=x+t.length,C=x+t.length+1,P=x+1;r.push(I,A,P),r.push(C,P,A)}this.setIndex(r),this.setAttribute("position",new $t(a,3)),this.setAttribute("uv",new $t(o,2)),this.setAttribute("normal",new $t(c,3))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Nr(t.points,t.segments,t.phiStart,t.phiLength)}}class Vo extends Nr{constructor(t=1,e=1,i=4,n=8){const r=new _o;r.absarc(0,-e/2,t,Math.PI*1.5,0),r.absarc(0,e/2,t,0,Math.PI*.5),super(r.getPoints(i),n),this.type="CapsuleGeometry",this.parameters={radius:t,length:e,capSegments:i,radialSegments:n}}static fromJSON(t){return new Vo(t.radius,t.length,t.capSegments,t.radialSegments)}}class bi extends ye{constructor(t=1,e=32,i=0,n=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:e,thetaStart:i,thetaLength:n},e=Math.max(3,e);const r=[],a=[],o=[],l=[],c=new R,h=new lt;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let u=0,d=3;u<=e;u++,d+=3){const p=i+u/e*n;c.x=t*Math.cos(p),c.y=t*Math.sin(p),a.push(c.x,c.y,c.z),o.push(0,0,1),h.x=(a[d]/t+1)/2,h.y=(a[d+1]/t+1)/2,l.push(h.x,h.y)}for(let u=1;u<=e;u++)r.push(u,u+1,0);this.setIndex(r),this.setAttribute("position",new $t(a,3)),this.setAttribute("normal",new $t(o,3)),this.setAttribute("uv",new $t(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new bi(t.radius,t.segments,t.thetaStart,t.thetaLength)}}class je extends ye{constructor(t=1,e=1,i=1,n=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:i,radialSegments:n,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};const c=this;n=Math.floor(n),r=Math.floor(r);const h=[],u=[],d=[],p=[];let g=0;const v=[],m=i/2;let f=0;M(),a===!1&&(t>0&&y(!0),e>0&&y(!1)),this.setIndex(h),this.setAttribute("position",new $t(u,3)),this.setAttribute("normal",new $t(d,3)),this.setAttribute("uv",new $t(p,2));function M(){const x=new R,I=new R;let A=0;const C=(e-t)/i;for(let P=0;P<=r;P++){const S=[],_=P/r,L=_*(e-t)+t;for(let O=0;O<=n;O++){const F=O/n,G=F*l+o,q=Math.sin(G),W=Math.cos(G);I.x=L*q,I.y=-_*i+m,I.z=L*W,u.push(I.x,I.y,I.z),x.set(q,C,W).normalize(),d.push(x.x,x.y,x.z),p.push(F,1-_),S.push(g++)}v.push(S)}for(let P=0;P<n;P++)for(let S=0;S<r;S++){const _=v[S][P],L=v[S+1][P],O=v[S+1][P+1],F=v[S][P+1];(t>0||S!==0)&&(h.push(_,L,F),A+=3),(e>0||S!==r-1)&&(h.push(L,O,F),A+=3)}c.addGroup(f,A,0),f+=A}function y(x){const I=g,A=new lt,C=new R;let P=0;const S=x===!0?t:e,_=x===!0?1:-1;for(let O=1;O<=n;O++)u.push(0,m*_,0),d.push(0,_,0),p.push(.5,.5),g++;const L=g;for(let O=0;O<=n;O++){const G=O/n*l+o,q=Math.cos(G),W=Math.sin(G);C.x=S*W,C.y=m*_,C.z=S*q,u.push(C.x,C.y,C.z),d.push(0,_,0),A.x=q*.5+.5,A.y=W*.5*_+.5,p.push(A.x,A.y),g++}for(let O=0;O<n;O++){const F=I+O,G=L+O;x===!0?h.push(G,G+1,F):h.push(G+1,G,F),P+=3}c.addGroup(f,P,x===!0?1:2),f+=P}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new je(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class kr extends je{constructor(t=1,e=1,i=32,n=1,r=!1,a=0,o=Math.PI*2){super(0,t,e,i,n,r,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:i,heightSegments:n,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(t){return new kr(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class Wo extends ye{constructor(t=[],e=[],i=1,n=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:i,detail:n};const r=[],a=[];o(n),c(i),h(),this.setAttribute("position",new $t(r,3)),this.setAttribute("normal",new $t(r.slice(),3)),this.setAttribute("uv",new $t(a,2)),n===0?this.computeVertexNormals():this.normalizeNormals();function o(M){const y=new R,x=new R,I=new R;for(let A=0;A<e.length;A+=3)p(e[A+0],y),p(e[A+1],x),p(e[A+2],I),l(y,x,I,M)}function l(M,y,x,I){const A=I+1,C=[];for(let P=0;P<=A;P++){C[P]=[];const S=M.clone().lerp(x,P/A),_=y.clone().lerp(x,P/A),L=A-P;for(let O=0;O<=L;O++)O===0&&P===A?C[P][O]=S:C[P][O]=S.clone().lerp(_,O/L)}for(let P=0;P<A;P++)for(let S=0;S<2*(A-P)-1;S++){const _=Math.floor(S/2);S%2===0?(d(C[P][_+1]),d(C[P+1][_]),d(C[P][_])):(d(C[P][_+1]),d(C[P+1][_+1]),d(C[P+1][_]))}}function c(M){const y=new R;for(let x=0;x<r.length;x+=3)y.x=r[x+0],y.y=r[x+1],y.z=r[x+2],y.normalize().multiplyScalar(M),r[x+0]=y.x,r[x+1]=y.y,r[x+2]=y.z}function h(){const M=new R;for(let y=0;y<r.length;y+=3){M.x=r[y+0],M.y=r[y+1],M.z=r[y+2];const x=m(M)/2/Math.PI+.5,I=f(M)/Math.PI+.5;a.push(x,1-I)}g(),u()}function u(){for(let M=0;M<a.length;M+=6){const y=a[M+0],x=a[M+2],I=a[M+4],A=Math.max(y,x,I),C=Math.min(y,x,I);A>.9&&C<.1&&(y<.2&&(a[M+0]+=1),x<.2&&(a[M+2]+=1),I<.2&&(a[M+4]+=1))}}function d(M){r.push(M.x,M.y,M.z)}function p(M,y){const x=M*3;y.x=t[x+0],y.y=t[x+1],y.z=t[x+2]}function g(){const M=new R,y=new R,x=new R,I=new R,A=new lt,C=new lt,P=new lt;for(let S=0,_=0;S<r.length;S+=9,_+=6){M.set(r[S+0],r[S+1],r[S+2]),y.set(r[S+3],r[S+4],r[S+5]),x.set(r[S+6],r[S+7],r[S+8]),A.set(a[_+0],a[_+1]),C.set(a[_+2],a[_+3]),P.set(a[_+4],a[_+5]),I.copy(M).add(y).add(x).divideScalar(3);const L=m(I);v(A,_+0,M,L),v(C,_+2,y,L),v(P,_+4,x,L)}}function v(M,y,x,I){I<0&&M.x===1&&(a[y]=M.x-1),x.x===0&&x.z===0&&(a[y]=I/2/Math.PI+.5)}function m(M){return Math.atan2(M.z,-M.x)}function f(M){return Math.atan2(-M.y,Math.sqrt(M.x*M.x+M.z*M.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Wo(t.vertices,t.indices,t.radius,t.details)}}class Xo extends _o{constructor(t){super(t),this.uuid=hn(),this.type="Shape",this.holes=[]}getPointsHoles(t){const e=[];for(let i=0,n=this.holes.length;i<n;i++)e[i]=this.holes[i].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,i=t.holes.length;e<i;e++){const n=t.holes[e];this.holes.push(n.clone())}return this}toJSON(){const t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,i=this.holes.length;e<i;e++){const n=this.holes[e];t.holes.push(n.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,i=t.holes.length;e<i;e++){const n=t.holes[e];this.holes.push(new _o().fromJSON(n))}return this}}const kg={triangulate:function(s,t,e=2){const i=t&&t.length,n=i?t[0]*e:s.length;let r=yh(s,0,n,e,!0);const a=[];if(!r||r.next===r.prev)return a;let o,l,c,h,u,d,p;if(i&&(r=Hg(s,t,r,e)),s.length>80*e){o=c=s[0],l=h=s[1];for(let g=e;g<n;g+=e)u=s[g],d=s[g+1],u<o&&(o=u),d<l&&(l=d),u>c&&(c=u),d>h&&(h=d);p=Math.max(c-o,h-l),p=p!==0?32767/p:0}return ws(r,a,e,o,l,p,0),a}};function yh(s,t,e,i,n){let r,a;if(n===Jg(s,t,e,i)>0)for(r=t;r<e;r+=i)a=uc(r,s[r],s[r+1],a);else for(r=e-i;r>=t;r-=i)a=uc(r,s[r],s[r+1],a);return a&&Or(a,a.next)&&(Ts(a),a=a.next),a}function an(s,t){if(!s)return s;t||(t=s);let e=s,i;do if(i=!1,!e.steiner&&(Or(e,e.next)||me(e.prev,e,e.next)===0)){if(Ts(e),e=t=e.prev,e===e.next)break;i=!0}else e=e.next;while(i||e!==t);return t}function ws(s,t,e,i,n,r,a){if(!s)return;!a&&r&&qg(s,i,n,r);let o=s,l,c;for(;s.prev!==s.next;){if(l=s.prev,c=s.next,r?Fg(s,i,n,r):Og(s)){t.push(l.i/e|0),t.push(s.i/e|0),t.push(c.i/e|0),Ts(s),s=c.next,o=c.next;continue}if(s=c,s===o){a?a===1?(s=zg(an(s),t,e),ws(s,t,e,i,n,r,2)):a===2&&Bg(s,t,e,i,n,r):ws(an(s),t,e,i,n,r,1);break}}}function Og(s){const t=s.prev,e=s,i=s.next;if(me(t,e,i)>=0)return!1;const n=t.x,r=e.x,a=i.x,o=t.y,l=e.y,c=i.y,h=n<r?n<a?n:a:r<a?r:a,u=o<l?o<c?o:c:l<c?l:c,d=n>r?n>a?n:a:r>a?r:a,p=o>l?o>c?o:c:l>c?l:c;let g=i.next;for(;g!==t;){if(g.x>=h&&g.x<=d&&g.y>=u&&g.y<=p&&Dn(n,o,r,l,a,c,g.x,g.y)&&me(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function Fg(s,t,e,i){const n=s.prev,r=s,a=s.next;if(me(n,r,a)>=0)return!1;const o=n.x,l=r.x,c=a.x,h=n.y,u=r.y,d=a.y,p=o<l?o<c?o:c:l<c?l:c,g=h<u?h<d?h:d:u<d?u:d,v=o>l?o>c?o:c:l>c?l:c,m=h>u?h>d?h:d:u>d?u:d,f=yo(p,g,t,e,i),M=yo(v,m,t,e,i);let y=s.prevZ,x=s.nextZ;for(;y&&y.z>=f&&x&&x.z<=M;){if(y.x>=p&&y.x<=v&&y.y>=g&&y.y<=m&&y!==n&&y!==a&&Dn(o,h,l,u,c,d,y.x,y.y)&&me(y.prev,y,y.next)>=0||(y=y.prevZ,x.x>=p&&x.x<=v&&x.y>=g&&x.y<=m&&x!==n&&x!==a&&Dn(o,h,l,u,c,d,x.x,x.y)&&me(x.prev,x,x.next)>=0))return!1;x=x.nextZ}for(;y&&y.z>=f;){if(y.x>=p&&y.x<=v&&y.y>=g&&y.y<=m&&y!==n&&y!==a&&Dn(o,h,l,u,c,d,y.x,y.y)&&me(y.prev,y,y.next)>=0)return!1;y=y.prevZ}for(;x&&x.z<=M;){if(x.x>=p&&x.x<=v&&x.y>=g&&x.y<=m&&x!==n&&x!==a&&Dn(o,h,l,u,c,d,x.x,x.y)&&me(x.prev,x,x.next)>=0)return!1;x=x.nextZ}return!0}function zg(s,t,e){let i=s;do{const n=i.prev,r=i.next.next;!Or(n,r)&&Mh(n,i,i.next,r)&&Es(n,r)&&Es(r,n)&&(t.push(n.i/e|0),t.push(i.i/e|0),t.push(r.i/e|0),Ts(i),Ts(i.next),i=s=r),i=i.next}while(i!==s);return an(i)}function Bg(s,t,e,i,n,r){let a=s;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&$g(a,o)){let l=Sh(a,o);a=an(a,a.next),l=an(l,l.next),ws(a,t,e,i,n,r,0),ws(l,t,e,i,n,r,0);return}o=o.next}a=a.next}while(a!==s)}function Hg(s,t,e,i){const n=[];let r,a,o,l,c;for(r=0,a=t.length;r<a;r++)o=t[r]*i,l=r<a-1?t[r+1]*i:s.length,c=yh(s,o,l,i,!1),c===c.next&&(c.steiner=!0),n.push(Kg(c));for(n.sort(Gg),r=0;r<n.length;r++)e=Vg(n[r],e);return e}function Gg(s,t){return s.x-t.x}function Vg(s,t){const e=Wg(s,t);if(!e)return t;const i=Sh(e,s);return an(i,i.next),an(e,e.next)}function Wg(s,t){let e=t,i=-1/0,n;const r=s.x,a=s.y;do{if(a<=e.y&&a>=e.next.y&&e.next.y!==e.y){const d=e.x+(a-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(d<=r&&d>i&&(i=d,n=e.x<e.next.x?e:e.next,d===r))return n}e=e.next}while(e!==t);if(!n)return null;const o=n,l=n.x,c=n.y;let h=1/0,u;e=n;do r>=e.x&&e.x>=l&&r!==e.x&&Dn(a<c?r:i,a,l,c,a<c?i:r,a,e.x,e.y)&&(u=Math.abs(a-e.y)/(r-e.x),Es(e,s)&&(u<h||u===h&&(e.x>n.x||e.x===n.x&&Xg(n,e)))&&(n=e,h=u)),e=e.next;while(e!==o);return n}function Xg(s,t){return me(s.prev,s,t.prev)<0&&me(t.next,s,s.next)<0}function qg(s,t,e,i){let n=s;do n.z===0&&(n.z=yo(n.x,n.y,t,e,i)),n.prevZ=n.prev,n.nextZ=n.next,n=n.next;while(n!==s);n.prevZ.nextZ=null,n.prevZ=null,Yg(n)}function Yg(s){let t,e,i,n,r,a,o,l,c=1;do{for(e=s,s=null,r=null,a=0;e;){for(a++,i=e,o=0,t=0;t<c&&(o++,i=i.nextZ,!!i);t++);for(l=c;o>0||l>0&&i;)o!==0&&(l===0||!i||e.z<=i.z)?(n=e,e=e.nextZ,o--):(n=i,i=i.nextZ,l--),r?r.nextZ=n:s=n,n.prevZ=r,r=n;e=i}r.nextZ=null,c*=2}while(a>1);return s}function yo(s,t,e,i,n){return s=(s-e)*n|0,t=(t-i)*n|0,s=(s|s<<8)&16711935,s=(s|s<<4)&252645135,s=(s|s<<2)&858993459,s=(s|s<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,s|t<<1}function Kg(s){let t=s,e=s;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==s);return e}function Dn(s,t,e,i,n,r,a,o){return(n-a)*(t-o)>=(s-a)*(r-o)&&(s-a)*(i-o)>=(e-a)*(t-o)&&(e-a)*(r-o)>=(n-a)*(i-o)}function $g(s,t){return s.next.i!==t.i&&s.prev.i!==t.i&&!jg(s,t)&&(Es(s,t)&&Es(t,s)&&Zg(s,t)&&(me(s.prev,s,t.prev)||me(s,t.prev,t))||Or(s,t)&&me(s.prev,s,s.next)>0&&me(t.prev,t,t.next)>0)}function me(s,t,e){return(t.y-s.y)*(e.x-t.x)-(t.x-s.x)*(e.y-t.y)}function Or(s,t){return s.x===t.x&&s.y===t.y}function Mh(s,t,e,i){const n=ur(me(s,t,e)),r=ur(me(s,t,i)),a=ur(me(e,i,s)),o=ur(me(e,i,t));return!!(n!==r&&a!==o||n===0&&hr(s,e,t)||r===0&&hr(s,i,t)||a===0&&hr(e,s,i)||o===0&&hr(e,t,i))}function hr(s,t,e){return t.x<=Math.max(s.x,e.x)&&t.x>=Math.min(s.x,e.x)&&t.y<=Math.max(s.y,e.y)&&t.y>=Math.min(s.y,e.y)}function ur(s){return s>0?1:s<0?-1:0}function jg(s,t){let e=s;do{if(e.i!==s.i&&e.next.i!==s.i&&e.i!==t.i&&e.next.i!==t.i&&Mh(e,e.next,s,t))return!0;e=e.next}while(e!==s);return!1}function Es(s,t){return me(s.prev,s,s.next)<0?me(s,t,s.next)>=0&&me(s,s.prev,t)>=0:me(s,t,s.prev)<0||me(s,s.next,t)<0}function Zg(s,t){let e=s,i=!1;const n=(s.x+t.x)/2,r=(s.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&n<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(i=!i),e=e.next;while(e!==s);return i}function Sh(s,t){const e=new Mo(s.i,s.x,s.y),i=new Mo(t.i,t.x,t.y),n=s.next,r=t.prev;return s.next=t,t.prev=s,e.next=n,n.prev=e,i.next=e,e.prev=i,r.next=i,i.prev=r,i}function uc(s,t,e,i){const n=new Mo(s,t,e);return i?(n.next=i.next,n.prev=i,i.next.prev=n,i.next=n):(n.prev=n,n.next=n),n}function Ts(s){s.next.prev=s.prev,s.prev.next=s.next,s.prevZ&&(s.prevZ.nextZ=s.nextZ),s.nextZ&&(s.nextZ.prevZ=s.prevZ)}function Mo(s,t,e){this.i=s,this.x=t,this.y=e,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}function Jg(s,t,e,i){let n=0;for(let r=t,a=e-i;r<e;r+=i)n+=(s[a]-s[r])*(s[r+1]+s[a+1]),a=r;return n}class vs{static area(t){const e=t.length;let i=0;for(let n=e-1,r=0;r<e;n=r++)i+=t[n].x*t[r].y-t[r].x*t[n].y;return i*.5}static isClockWise(t){return vs.area(t)<0}static triangulateShape(t,e){const i=[],n=[],r=[];dc(t),fc(i,t);let a=t.length;e.forEach(dc);for(let l=0;l<e.length;l++)n.push(a),a+=e[l].length,fc(i,e[l]);const o=kg.triangulate(i,n);for(let l=0;l<o.length;l+=3)r.push(o.slice(l,l+3));return r}}function dc(s){const t=s.length;t>2&&s[t-1].equals(s[0])&&s.pop()}function fc(s,t){for(let e=0;e<t.length;e++)s.push(t[e].x),s.push(t[e].y)}class Fr extends ye{constructor(t=new Xo([new lt(.5,.5),new lt(-.5,.5),new lt(-.5,-.5),new lt(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];const i=this,n=[],r=[];for(let o=0,l=t.length;o<l;o++){const c=t[o];a(c)}this.setAttribute("position",new $t(n,3)),this.setAttribute("uv",new $t(r,2)),this.computeVertexNormals();function a(o){const l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,u=e.depth!==void 0?e.depth:1;let d=e.bevelEnabled!==void 0?e.bevelEnabled:!0,p=e.bevelThickness!==void 0?e.bevelThickness:.2,g=e.bevelSize!==void 0?e.bevelSize:p-.1,v=e.bevelOffset!==void 0?e.bevelOffset:0,m=e.bevelSegments!==void 0?e.bevelSegments:3;const f=e.extrudePath,M=e.UVGenerator!==void 0?e.UVGenerator:Qg;let y,x=!1,I,A,C,P;f&&(y=f.getSpacedPoints(h),x=!0,d=!1,I=f.computeFrenetFrames(h,!1),A=new R,C=new R,P=new R),d||(m=0,p=0,g=0,v=0);const S=o.extractPoints(c);let _=S.shape;const L=S.holes;if(!vs.isClockWise(_)){_=_.reverse();for(let Q=0,st=L.length;Q<st;Q++){const T=L[Q];vs.isClockWise(T)&&(L[Q]=T.reverse())}}const F=vs.triangulateShape(_,L),G=_;for(let Q=0,st=L.length;Q<st;Q++){const T=L[Q];_=_.concat(T)}function q(Q,st,T){return st||console.error("THREE.ExtrudeGeometry: vec does not exist"),Q.clone().addScaledVector(st,T)}const W=_.length,Z=F.length;function V(Q,st,T){let et,j,ut;const ot=Q.x-st.x,Dt=Q.y-st.y,mt=T.x-Q.x,E=T.y-Q.y,b=ot*ot+Dt*Dt,z=ot*E-Dt*mt;if(Math.abs(z)>Number.EPSILON){const K=Math.sqrt(b),tt=Math.sqrt(mt*mt+E*E),$=st.x-Dt/K,Et=st.y+ot/K,ft=T.x-E/tt,yt=T.y+mt/tt,Yt=((ft-$)*E-(yt-Et)*mt)/(ot*E-Dt*mt);et=$+ot*Yt-Q.x,j=Et+Dt*Yt-Q.y;const it=et*et+j*j;if(it<=2)return new lt(et,j);ut=Math.sqrt(it/2)}else{let K=!1;ot>Number.EPSILON?mt>Number.EPSILON&&(K=!0):ot<-Number.EPSILON?mt<-Number.EPSILON&&(K=!0):Math.sign(Dt)===Math.sign(E)&&(K=!0),K?(et=-Dt,j=ot,ut=Math.sqrt(b)):(et=ot,j=Dt,ut=Math.sqrt(b/2))}return new lt(et/ut,j/ut)}const ct=[];for(let Q=0,st=G.length,T=st-1,et=Q+1;Q<st;Q++,T++,et++)T===st&&(T=0),et===st&&(et=0),ct[Q]=V(G[Q],G[T],G[et]);const ht=[];let Mt,zt=ct.concat();for(let Q=0,st=L.length;Q<st;Q++){const T=L[Q];Mt=[];for(let et=0,j=T.length,ut=j-1,ot=et+1;et<j;et++,ut++,ot++)ut===j&&(ut=0),ot===j&&(ot=0),Mt[et]=V(T[et],T[ut],T[ot]);ht.push(Mt),zt=zt.concat(Mt)}for(let Q=0;Q<m;Q++){const st=Q/m,T=p*Math.cos(st*Math.PI/2),et=g*Math.sin(st*Math.PI/2)+v;for(let j=0,ut=G.length;j<ut;j++){const ot=q(G[j],ct[j],et);at(ot.x,ot.y,-T)}for(let j=0,ut=L.length;j<ut;j++){const ot=L[j];Mt=ht[j];for(let Dt=0,mt=ot.length;Dt<mt;Dt++){const E=q(ot[Dt],Mt[Dt],et);at(E.x,E.y,-T)}}}const jt=g+v;for(let Q=0;Q<W;Q++){const st=d?q(_[Q],zt[Q],jt):_[Q];x?(C.copy(I.normals[0]).multiplyScalar(st.x),A.copy(I.binormals[0]).multiplyScalar(st.y),P.copy(y[0]).add(C).add(A),at(P.x,P.y,P.z)):at(st.x,st.y,0)}for(let Q=1;Q<=h;Q++)for(let st=0;st<W;st++){const T=d?q(_[st],zt[st],jt):_[st];x?(C.copy(I.normals[Q]).multiplyScalar(T.x),A.copy(I.binormals[Q]).multiplyScalar(T.y),P.copy(y[Q]).add(C).add(A),at(P.x,P.y,P.z)):at(T.x,T.y,u/h*Q)}for(let Q=m-1;Q>=0;Q--){const st=Q/m,T=p*Math.cos(st*Math.PI/2),et=g*Math.sin(st*Math.PI/2)+v;for(let j=0,ut=G.length;j<ut;j++){const ot=q(G[j],ct[j],et);at(ot.x,ot.y,u+T)}for(let j=0,ut=L.length;j<ut;j++){const ot=L[j];Mt=ht[j];for(let Dt=0,mt=ot.length;Dt<mt;Dt++){const E=q(ot[Dt],Mt[Dt],et);x?at(E.x,E.y+y[h-1].y,y[h-1].x+T):at(E.x,E.y,u+T)}}}Y(),nt();function Y(){const Q=n.length/3;if(d){let st=0,T=W*st;for(let et=0;et<Z;et++){const j=F[et];Lt(j[2]+T,j[1]+T,j[0]+T)}st=h+m*2,T=W*st;for(let et=0;et<Z;et++){const j=F[et];Lt(j[0]+T,j[1]+T,j[2]+T)}}else{for(let st=0;st<Z;st++){const T=F[st];Lt(T[2],T[1],T[0])}for(let st=0;st<Z;st++){const T=F[st];Lt(T[0]+W*h,T[1]+W*h,T[2]+W*h)}}i.addGroup(Q,n.length/3-Q,0)}function nt(){const Q=n.length/3;let st=0;St(G,st),st+=G.length;for(let T=0,et=L.length;T<et;T++){const j=L[T];St(j,st),st+=j.length}i.addGroup(Q,n.length/3-Q,1)}function St(Q,st){let T=Q.length;for(;--T>=0;){const et=T;let j=T-1;j<0&&(j=Q.length-1);for(let ut=0,ot=h+m*2;ut<ot;ut++){const Dt=W*ut,mt=W*(ut+1),E=st+et+Dt,b=st+j+Dt,z=st+j+mt,K=st+et+mt;kt(E,b,z,K)}}}function at(Q,st,T){l.push(Q),l.push(st),l.push(T)}function Lt(Q,st,T){Nt(Q),Nt(st),Nt(T);const et=n.length/3,j=M.generateTopUV(i,n,et-3,et-2,et-1);qt(j[0]),qt(j[1]),qt(j[2])}function kt(Q,st,T,et){Nt(Q),Nt(st),Nt(et),Nt(st),Nt(T),Nt(et);const j=n.length/3,ut=M.generateSideWallUV(i,n,j-6,j-3,j-2,j-1);qt(ut[0]),qt(ut[1]),qt(ut[3]),qt(ut[1]),qt(ut[2]),qt(ut[3])}function Nt(Q){n.push(l[Q*3+0]),n.push(l[Q*3+1]),n.push(l[Q*3+2])}function qt(Q){r.push(Q.x),r.push(Q.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON(),e=this.parameters.shapes,i=this.parameters.options;return tv(e,i,t)}static fromJSON(t,e){const i=[];for(let r=0,a=t.shapes.length;r<a;r++){const o=e[t.shapes[r]];i.push(o)}const n=t.options.extrudePath;return n!==void 0&&(t.options.extrudePath=new xo[n.type]().fromJSON(n)),new Fr(i,t.options)}}const Qg={generateTopUV:function(s,t,e,i,n){const r=t[e*3],a=t[e*3+1],o=t[i*3],l=t[i*3+1],c=t[n*3],h=t[n*3+1];return[new lt(r,a),new lt(o,l),new lt(c,h)]},generateSideWallUV:function(s,t,e,i,n,r){const a=t[e*3],o=t[e*3+1],l=t[e*3+2],c=t[i*3],h=t[i*3+1],u=t[i*3+2],d=t[n*3],p=t[n*3+1],g=t[n*3+2],v=t[r*3],m=t[r*3+1],f=t[r*3+2];return Math.abs(o-h)<Math.abs(a-c)?[new lt(a,1-l),new lt(c,1-u),new lt(d,1-g),new lt(v,1-f)]:[new lt(o,1-l),new lt(h,1-u),new lt(p,1-g),new lt(m,1-f)]}};function tv(s,t,e){if(e.shapes=[],Array.isArray(s))for(let i=0,n=s.length;i<n;i++){const r=s[i];e.shapes.push(r.uuid)}else e.shapes.push(s.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}class Yn extends Wo{constructor(t=1,e=0){const i=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],n=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(i,n,t,e),this.type="OctahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new Yn(t.radius,t.detail)}}class zi extends ye{constructor(t=.5,e=1,i=32,n=1,r=0,a=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:t,outerRadius:e,thetaSegments:i,phiSegments:n,thetaStart:r,thetaLength:a},i=Math.max(3,i),n=Math.max(1,n);const o=[],l=[],c=[],h=[];let u=t;const d=(e-t)/n,p=new R,g=new lt;for(let v=0;v<=n;v++){for(let m=0;m<=i;m++){const f=r+m/i*a;p.x=u*Math.cos(f),p.y=u*Math.sin(f),l.push(p.x,p.y,p.z),c.push(0,0,1),g.x=(p.x/e+1)/2,g.y=(p.y/e+1)/2,h.push(g.x,g.y)}u+=d}for(let v=0;v<n;v++){const m=v*(i+1);for(let f=0;f<i;f++){const M=f+m,y=M,x=M+i+1,I=M+i+2,A=M+1;o.push(y,x,A),o.push(x,I,A)}}this.setIndex(o),this.setAttribute("position",new $t(l,3)),this.setAttribute("normal",new $t(c,3)),this.setAttribute("uv",new $t(h,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new zi(t.innerRadius,t.outerRadius,t.thetaSegments,t.phiSegments,t.thetaStart,t.thetaLength)}}class Xe extends ye{constructor(t=1,e=32,i=16,n=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:i,phiStart:n,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),i=Math.max(2,Math.floor(i));const l=Math.min(a+o,Math.PI);let c=0;const h=[],u=new R,d=new R,p=[],g=[],v=[],m=[];for(let f=0;f<=i;f++){const M=[],y=f/i;let x=0;f===0&&a===0?x=.5/e:f===i&&l===Math.PI&&(x=-.5/e);for(let I=0;I<=e;I++){const A=I/e;u.x=-t*Math.cos(n+A*r)*Math.sin(a+y*o),u.y=t*Math.cos(a+y*o),u.z=t*Math.sin(n+A*r)*Math.sin(a+y*o),g.push(u.x,u.y,u.z),d.copy(u).normalize(),v.push(d.x,d.y,d.z),m.push(A+x,1-y),M.push(c++)}h.push(M)}for(let f=0;f<i;f++)for(let M=0;M<e;M++){const y=h[f][M+1],x=h[f][M],I=h[f+1][M],A=h[f+1][M+1];(f!==0||a>0)&&p.push(y,x,A),(f!==i-1||l<Math.PI)&&p.push(x,I,A)}this.setIndex(p),this.setAttribute("position",new $t(g,3)),this.setAttribute("normal",new $t(v,3)),this.setAttribute("uv",new $t(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Xe(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class on extends ye{constructor(t=1,e=.4,i=12,n=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:i,tubularSegments:n,arc:r},i=Math.floor(i),n=Math.floor(n);const a=[],o=[],l=[],c=[],h=new R,u=new R,d=new R;for(let p=0;p<=i;p++)for(let g=0;g<=n;g++){const v=g/n*r,m=p/i*Math.PI*2;u.x=(t+e*Math.cos(m))*Math.cos(v),u.y=(t+e*Math.cos(m))*Math.sin(v),u.z=e*Math.sin(m),o.push(u.x,u.y,u.z),h.x=t*Math.cos(v),h.y=t*Math.sin(v),d.subVectors(u,h).normalize(),l.push(d.x,d.y,d.z),c.push(g/n),c.push(p/i)}for(let p=1;p<=i;p++)for(let g=1;g<=n;g++){const v=(n+1)*p+g-1,m=(n+1)*(p-1)+g-1,f=(n+1)*(p-1)+g,M=(n+1)*p+g;a.push(v,m,M),a.push(m,f,M)}this.setIndex(a),this.setAttribute("position",new $t(o,3)),this.setAttribute("normal",new $t(l,3)),this.setAttribute("uv",new $t(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new on(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}}class pe extends Bi{static get type(){return"MeshStandardMaterial"}constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.color=new Ut(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ut(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=ko,this.normalScale=new lt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ci,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class ev extends Bi{static get type(){return"MeshToonMaterial"}constructor(t){super(),this.isMeshToonMaterial=!0,this.defines={TOON:""},this.color=new Ut(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ut(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=ko,this.normalScale=new lt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.gradientMap=t.gradientMap,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.alphaMap=t.alphaMap,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}class qo extends xe{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Ut(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}}class zr extends qo{constructor(t,e,i){super(t,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(xe.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ut(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const wa=new se,pc=new R,mc=new R;class bh{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new lt(512,512),this.map=null,this.mapPass=null,this.matrix=new se,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new zo,this._frameExtents=new lt(1,1),this._viewportCount=1,this._viewports=[new ae(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,i=this.matrix;pc.setFromMatrixPosition(t.matrixWorld),e.position.copy(pc),mc.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(mc),e.updateMatrixWorld(),wa.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(wa),i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(wa)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}const gc=new se,ls=new R,Ea=new R;class iv extends bh{constructor(){super(new We(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new lt(4,2),this._viewportCount=6,this._viewports=[new ae(2,1,1,1),new ae(0,1,1,1),new ae(3,1,1,1),new ae(1,1,1,1),new ae(3,0,1,1),new ae(1,0,1,1)],this._cubeDirections=[new R(1,0,0),new R(-1,0,0),new R(0,0,1),new R(0,0,-1),new R(0,1,0),new R(0,-1,0)],this._cubeUps=[new R(0,1,0),new R(0,1,0),new R(0,1,0),new R(0,1,0),new R(0,0,1),new R(0,0,-1)]}updateMatrices(t,e=0){const i=this.camera,n=this.matrix,r=t.distance||i.far;r!==i.far&&(i.far=r,i.updateProjectionMatrix()),ls.setFromMatrixPosition(t.matrixWorld),i.position.copy(ls),Ea.copy(i.position),Ea.add(this._cubeDirections[e]),i.up.copy(this._cubeUps[e]),i.lookAt(Ea),i.updateMatrixWorld(),n.makeTranslation(-ls.x,-ls.y,-ls.z),gc.multiplyMatrices(i.projectionMatrix,i.matrixWorldInverse),this._frustum.setFromProjectionMatrix(gc)}}class ln extends qo{constructor(t,e,i=0,n=2){super(t,e),this.isPointLight=!0,this.type="PointLight",this.distance=i,this.decay=n,this.shadow=new iv}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}}class nv extends bh{constructor(){super(new oh(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class sv extends qo{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(xe.DEFAULT_UP),this.updateMatrix(),this.target=new xe,this.shadow=new nv}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Ro}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Ro);const As=["light","heavy","special","throw","jump","guard","stepIn","stepOut","target","pause"],So=[...As,"confirm","back"],rv=["left","right","up","down"],vc=[...rv,...As],xc=[...As],wh={keyboard:{left:["KeyA"],right:["KeyD"],up:["KeyW"],down:["KeyS"],jump:["Space"],light:["KeyJ"],heavy:["KeyK"],special:["KeyL"],throw:["KeyI"],guard:["KeyU"],stepIn:["KeyQ"],stepOut:["KeyE"],target:["Tab"],pause:[]},pad:{light:[0],heavy:[1],special:[2],throw:[3],stepIn:[4],stepOut:[5],guard:[6],jump:[7],target:[11],pause:[]}},_c={confirm:["Enter","Space"],back:["Escape","Backspace"]},yc={confirm:[0],back:[1,8]},dr={up:12,down:13,left:14,right:15},Eh=9,cs=.28,av=.55,ov=["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Tab","Enter","Backspace"],Th="hollow-arena.bindings.v2",Ah=6,lv=new Set(["Escape","Enter","KeyM","KeyF","CapsLock","NumLock","ScrollLock","ContextMenu","Power","Sleep","WakeUp","Unidentified",""]);function bo(s){return s==="Escape"||s==="Enter"?"Esc and Enter are fixed menu keys":s==="KeyM"||s==="KeyF"?"M and F are reserved for mute and fullscreen":lv.has(s)||/^(Meta|OS|Browser|Media|Launch|Audio|F\d+$)/.test(s)||!/^[A-Za-z0-9]{1,32}$/.test(s)?"that key cannot be bound":null}function wo(s){return s===Eh?"Start is fixed to Pause":s>=12&&s<=16?"the d-pad and Home cannot be bound":!Number.isInteger(s)||s<0||s>31?"that button cannot be bound":null}const Ii=[{id:"left",name:"Move left",pad:"Stick / D-pad ←"},{id:"right",name:"Move right",pad:"Stick / D-pad →"},{id:"up",name:"Up (jump)",pad:"Stick / D-pad ↑"},{id:"down",name:"Down (low attacks)",pad:"Stick / D-pad ↓"},{id:"jump",name:"Jump (hold for height)"},{id:"light",name:"Light attack (chain ×4)"},{id:"heavy",name:"Strong attack (launcher)"},{id:"throw",name:"Throw (beats guard)"},{id:"special",name:"Special (full Soul)"},{id:"stepIn",name:"Sidestep in"},{id:"stepOut",name:"Sidestep out"},{id:"guard",name:"Guard (hold)"},{id:"target",name:"Switch target"},{id:"pause",name:"Pause",fixedKb:["Esc","Enter"],fixedPad:"start"}],cv=[["Dash","double-tap left or right"],["Substitution","sidestep while being hit (half a Soul bar)"],["Guard","also when standing still or holding back"],["Low attacks","hold down + Light / Strong"],["Feint","Throw during a connecting string"],["Menus","arrows / stick move · Enter / A confirm · Esc / B back"]];function Eo(s){const t=Ii.find(e=>e.id===s);return t?t.name:s}function Rr(s=""){const t=(s||"").toLowerCase(),e={family:"Xbox",bottom:"A",right:"B",left:"X",top:"Y",lb:"LB",rb:"RB",lt:"LT",rt:"RT",select:"View",start:"Menu",l3:"L3",r3:"R3"};return/xbox|microsoft|045e/.test(t)?e:/nintendo|pro controller|joy-con|057e/.test(t)?{family:"Nintendo",bottom:"B",right:"A",left:"Y",top:"X",lb:"L",rb:"R",lt:"ZL",rt:"ZR",select:"−",start:"+",l3:"L-stick click",r3:"R-stick click"}:/playstation|dualshock|dualsense|054c|sony|wireless controller/.test(t)?{family:"PlayStation",bottom:"✕",right:"○",left:"□",top:"△",lb:"L1",rb:"R1",lt:"L2",rt:"R2",select:"Share",start:"Options",l3:"L3",r3:"R3"}:e}function xs(s,t=""){const e=Rr(t),i=[e.bottom,e.right,e.left,e.top,e.lb,e.rb,e.lt,e.rt,e.select,e.start,e.l3,e.r3,"D-pad ↑","D-pad ↓","D-pad ←","D-pad →","Home"];return i[s]!==void 0?i[s]:`Button ${s}`}const Mc={Space:"Space",Enter:"Enter",Escape:"Esc",Tab:"Tab",Backspace:"Bksp",Delete:"Del",Insert:"Ins",Home:"Home",End:"End",PageUp:"PgUp",PageDown:"PgDn",ShiftLeft:"L-Shift",ShiftRight:"R-Shift",ControlLeft:"L-Ctrl",ControlRight:"R-Ctrl",AltLeft:"L-Alt",AltRight:"R-Alt",MetaLeft:"L-Cmd",MetaRight:"R-Cmd",CapsLock:"Caps",ArrowLeft:"←",ArrowRight:"→",ArrowUp:"↑",ArrowDown:"↓",Comma:",",Period:".",Slash:"/",Semicolon:";",Quote:"'",BracketLeft:"[",BracketRight:"]",Backslash:"\\",Backquote:"`",Minus:"-",Equal:"=",NumpadAdd:"Num +",NumpadSubtract:"Num -",NumpadMultiply:"Num *",NumpadDivide:"Num /",NumpadEnter:"Num Enter",NumpadDecimal:"Num ."},_s={};function ys(s){return s?_s[s]?_s[s]:Mc[s]?Mc[s]:/^Key[A-Z]$/.test(s)?s.slice(3):/^Digit\d$/.test(s)?s.slice(5):/^Numpad\d$/.test(s)?"Num "+s.slice(6):s:"—"}function Sc(s,t){return s&&s.length?s.map(t).join(" / "):"—"}function Rh(s){const t=e=>Object.fromEntries(Object.entries(e).map(([i,n])=>[i,[...n]]));return{keyboard:t(s.keyboard),pad:t(s.pad)}}function Ch(s,t){return s==="up"&&t==="jump"||s==="jump"&&t==="up"}function bc(s,t,e){if(!s||typeof s!="object")return!1;const i=new Map;for(const n of t){const r=s[n];if(!Array.isArray(r)||r.length>1||r.length===0&&n!=="pause")return!1;for(const a of r){if(e?wo(a):bo(a))return!1;const o=i.get(a);if(o!==void 0&&!Ch(o,n))return!1;i.set(a,n)}}return!0}function hv(){const s=Rh(wh);let t={};try{const e=localStorage.getItem(Th);if(!e)return{bindings:s,labels:t};const i=JSON.parse(e);if(!i||typeof i!="object")return{bindings:s,labels:t};if(bc(i.keyboard,vc,!1))for(const n of vc)s.keyboard[n]=[...i.keyboard[n]];if(bc(i.pad,xc,!0))for(const n of xc)s.pad[n]=[...i.pad[n]];if(i.labels&&typeof i.labels=="object")for(const[n,r]of Object.entries(i.labels))typeof n=="string"&&typeof r=="string"&&r.length===1&&/^[A-Za-z0-9]{1,32}$/.test(n)&&(t[n]=r)}catch{}return{bindings:s,labels:t}}function uv(s,t){try{localStorage.setItem(Th,JSON.stringify({...s,labels:t}))}catch{}}function wc(s){return[...new Set(s)]}function Ec(s){const t=s.keyboard.light||[],e=s.keyboard.heavy||[];return{confirm:wc([..._c.confirm.filter(i=>!e.includes(i)),...t]),back:wc([..._c.back.filter(i=>!t.includes(i)),...e])}}function Tc(s){const t=new Set(ov);for(const e of Object.values(s.keyboard))for(const i of e)t.add(i);return t}function Ta(s,t){const e=s.buttons[t];return!!e&&(e.pressed||e.value>.5)}class dv{constructor(){this.x=0,this.y=0,this.held={},this.pressed={},this.released={},this.prevHeld={},this.nav={up:!1,down:!1,left:!1,right:!1,confirm:!1,back:!1},this._navHold={up:0,down:0,left:0,right:0},this.anyPressed=!1,this.deviceLabel="Keyboard",this.padId="";for(const t of So)this.held[t]=!1,this.pressed[t]=!1,this.released[t]=!1,this.prevHeld[t]=!1}}class fv{constructor(){this.down=new Set,this.tapped=new Set,this.swallow=new Set,this.players=[new dv];const t=hv();this.bindings=t.bindings,Object.assign(_s,t.labels),this.menuKeys=Ec(this.bindings),this.prevent=Tc(this.bindings),this.padInfo=new Map,this.padIndex=-1,this.padId="",this.padSuppressed=new Set,this.capture=null,this.onPadChange=null,this.onBindingsChange=null,this.anyPressed=!1,this.anyConfirm=!1,this.anyBack=!1,this.lastActiveDevice="keyboard",window.addEventListener("keydown",e=>{if(this.capture&&this.capture.device==="keyboard"){e.preventDefault(),e.stopImmediatePropagation(),!e.repeat&&!e.isComposing&&this._captureKey(e);return}this.prevent.has(e.code)&&e.preventDefault(),!e.repeat&&(this.down.add(e.code),this.tapped.add(e.code),this.lastActiveDevice="keyboard")}),window.addEventListener("keyup",e=>{this.down.delete(e.code),this.swallow.delete(e.code)}),window.addEventListener("blur",()=>{this.down.clear(),this.swallow.clear()}),window.addEventListener("gamepadconnected",e=>{const i=e.gamepad;i&&(this.padInfo.set(i.index,{id:i.id,mapping:i.mapping}),this.onPadChange&&this.onPadChange(i.index,!0,i.id))}),window.addEventListener("gamepaddisconnected",e=>{const i=e.gamepad;i&&(this.padInfo.delete(i.index),this.padIndex===i.index&&(this.padIndex=-1),this.capture&&this.capture.device==="pad"&&this.cancelCapture(),this.onPadChange&&this.onPadChange(i.index,!1,i.id))})}get capturing(){return!!this.capture}key(t){return(this.down.has(t)||this.tapped.has(t))&&!this.swallow.has(t)}_pads(){let t;try{t=navigator.getGamepads?navigator.getGamepads():[]}catch{t=[]}return t||[]}_pad(){const t=this._pads(),e=n=>n.buttons.some(r=>r&&(r.pressed||r.value>.5));let i=this.padIndex>=0&&t[this.padIndex]&&t[this.padIndex].connected?t[this.padIndex]:null;if(!i)for(let n=0;n<t.length;n++){const r=t[n];if(r&&r.connected){i=r,this.padIndex=n;break}}if(i&&!e(i))for(let n=0;n<t.length;n++){const r=t[n];if(!(!r||!r.connected||n===this.padIndex)&&e(r)){i=r,this.padIndex=n;break}}return i||(this.padIndex=-1),i}hasPad(){return!!this._pad()}firstPadId(){const t=this._pad();if(t)return t.id;const e=this.padInfo.values().next();return e.done?"":e.value.id}connectedPads(){const t=[],e=this._pads();for(let i=0;i<e.length;i++)e[i]&&e[i].connected&&t.push(i);return t}beginCapture(t,e){this.cancelCapture();const i=new Set;if(t==="pad"){const n=this._pad();n&&n.buttons.forEach((r,a)=>{r&&(r.pressed||r.value>.5)&&i.add(a)})}this.capture={device:t,resolve:e,t:0,baseline:i},this.tapped.clear()}cancelCapture(){this.capture&&this._endCapture(null)}_endCapture(t){const e=this.capture;if(!e)return;this.capture=null;for(const n of this.down)this.swallow.add(n);this.tapped.clear();const i=this._pad();i&&i.buttons.forEach((n,r)=>{n&&(n.pressed||n.value>.5)&&this.padSuppressed.add(r)}),e.resolve(t)}_captureKey(t){const e=t.code;if(e==="Escape"){this._endCapture(null);return}const i=bo(e);if(i){this._endCapture({error:i});return}typeof t.key=="string"&&t.key.length===1&&t.key!==" "&&(_s[e]=t.key.toUpperCase()),this._endCapture(e)}_capturePad(t){const e=this.capture;for(let i=0;i<t.buttons.length;i++){if(!Ta(t,i)){e.baseline.delete(i);continue}if(e.baseline.has(i))continue;const r=wo(i);this._endCapture(r?{error:r}:i);return}}bind(t,e,i){const n=t==="keyboard",r=n?this.bindings.keyboard:this.bindings.pad;if(!(e in r))return{ok:!1,moved:[],error:"unknown action"};const a=n?bo(i):wo(i);if(a)return{ok:!1,moved:[],error:a};const o=r[e][0];if(o===i)return{ok:!0,moved:[],error:null};const l=[],c=e==="up"?"jump":e==="jump"?"up":null,h=o!==void 0&&c&&r[c]&&r[c].includes(o);for(const u of Object.keys(r))if(!(u===e||Ch(e,u)||!r[u].includes(i))){if(o===void 0)return{ok:!1,moved:[],error:`${(n?ys:p=>xs(p,this.padId))(i)} is ${Eo(u)} — rebind ${Eo(u)} first`};r[u]=[o],l.push({action:u,code:o}),h&&(r[c]=[i],l.push({action:c,code:i}))}return r[e]=[i],this._bindingsChanged(),{ok:!0,moved:l,error:null}}resetBindings(){this.bindings=Rh(wh),this._bindingsChanged()}_bindingsChanged(){this.menuKeys=Ec(this.bindings),this.prevent=Tc(this.bindings),uv(this.bindings,_s),this.onBindingsChange&&this.onBindingsChange(this.bindings)}update(t){this.anyPressed=!1,this.anyConfirm=!1,this.anyBack=!1;const e=this.players[0],i=this._pad();if(i)this.padId=i.id;else{const m=this.padInfo.values().next();this.padId=m.done?"":m.value.id}let n=!1;this.capture&&(this.capture.t+=t,this.capture.device==="pad"&&(i?this._capturePad(i):this.cancelCapture()),this.capture&&this.capture.t>Ah&&this.cancelCapture(),n=!!this.capture,this.tapped.clear());const r=this.bindings.keyboard,a=m=>!!m&&m.some(f=>(this.down.has(f)||this.tapped.has(f))&&!this.swallow.has(f));let o=0,l=0,c=0,h=0;const u={};for(const m of So)u[m]=!1;let d="Keyboard";if(!n){a(r.left)&&(o-=1),a(r.right)&&(o+=1),a(r.up)&&(l+=1),a(r.down)&&(l-=1);for(const m of As)a(r[m])&&(u[m]=!0);a(this.menuKeys.confirm)&&(u.confirm=!0),a(this.menuKeys.back)&&(u.back=!0),a(["Escape"])&&(u.pause=!0,u.back=!0),a(["Enter"])&&(u.pause=!0),a(["ArrowLeft"])&&(c-=1),a(["ArrowRight"])&&(c+=1),a(["ArrowUp"])&&(h+=1),a(["ArrowDown"])&&(h-=1)}if(e.padId="",i){e.padId=i.id;for(const f of[...this.padSuppressed])Ta(i,f)||this.padSuppressed.delete(f);const m=f=>!this.padSuppressed.has(f)&&Ta(i,f);if(!n){const f=i.axes[0]||0,M=i.axes[1]||0,y=Math.hypot(f,M);if(y>cs){const I=Math.min(1,(y-cs)/(1-cs))/y;o+=f*I,l+=-M*I}m(dr.left)&&(o-=1),m(dr.right)&&(o+=1),m(dr.up)&&(l+=1),m(dr.down)&&(l-=1);const x=this.bindings.pad;for(const I of As)x[I]&&x[I].some(m)&&(u[I]=!0);m(Eh)&&(u.pause=!0),yc.confirm.some(m)&&(u.confirm=!0),yc.back.some(m)&&(u.back=!0),(Math.abs(f)>cs||Math.abs(M)>cs||i.buttons.some(I=>I&&I.pressed))&&(this.lastActiveDevice="gamepad")}d=`Keyboard + ${Rr(i.id).family} pad`}!n&&l>av&&(u.jump=!0),e.deviceLabel=d,e.x=Math.max(-1,Math.min(1,o)),e.y=Math.max(-1,Math.min(1,l)),e.anyPressed=!1;for(const m of So)e.prevHeld[m]=e.held[m],e.held[m]=u[m],e.pressed[m]=u[m]&&!e.prevHeld[m],e.released[m]=!u[m]&&e.prevHeld[m],e.pressed[m]&&(e.anyPressed=!0,this.anyPressed=!0);e.pressed.confirm&&(this.anyConfirm=!0),e.pressed.back&&(this.anyBack=!0);const p=Math.max(-1,Math.min(1,o+c)),g=Math.max(-1,Math.min(1,l+h)),v={up:g>.5,down:g<-.5,left:p<-.5,right:p>.5};for(const m of Object.keys(v))if(v[m]){const f=e._navHold[m];e.nav[m]=f===0||f>.38&&Math.floor((f-.38)/.11)!==Math.floor((f-.38-t)/.11),e._navHold[m]=f+t,e.nav[m]&&(this.anyPressed=!0)}else e._navHold[m]=0,e.nav[m]=!1;e.nav.confirm=e.pressed.confirm,e.nav.back=e.pressed.back,this.tapped.clear()}anyNav(){const t={up:!1,down:!1,left:!1,right:!1,confirm:!1,back:!1};for(const e of this.players)for(const i of Object.keys(t))e.nav[i]&&(t[i]=!0);return t}}class pv{constructor(){this.ctx=null,this.master=null,this.sfxGain=null,this.musicGain=null,this.muted=!1,this.music=null,this.noiseBuf=null,this.unlocked=!1}unlock(){if(!this.unlocked){try{const t=window.AudioContext||window.webkitAudioContext;this.ctx=new t,this.master=this.ctx.createGain(),this.master.gain.value=.8,this.master.connect(this.ctx.destination),this.sfxGain=this.ctx.createGain(),this.sfxGain.gain.value=.9,this.sfxGain.connect(this.master),this.musicGain=this.ctx.createGain(),this.musicGain.gain.value=.35,this.musicGain.connect(this.master);const e=this.ctx.sampleRate*1.5;this.noiseBuf=this.ctx.createBuffer(1,e,this.ctx.sampleRate);const i=this.noiseBuf.getChannelData(0);for(let n=0;n<e;n++)i[n]=Math.random()*2-1;this.unlocked=!0}catch(t){console.warn("Audio unavailable",t)}this.ctx&&this.ctx.state==="suspended"&&this.ctx.resume()}}toggleMute(){return this.muted=!this.muted,this.master&&(this.master.gain.value=this.muted?0:.8),this.muted}_osc(t,e,i,n,r,{attack:a=.004,curve:o="exp",dest:l=null,detune:c=0}={}){const h=this.ctx,u=h.currentTime,d=h.createOscillator();d.type=t,d.frequency.setValueAtTime(e,u),i!==e&&(o==="exp"?d.frequency.exponentialRampToValueAtTime(Math.max(1,i),u+n):d.frequency.linearRampToValueAtTime(i,u+n)),d.detune.value=c;const p=h.createGain();p.gain.setValueAtTime(0,u),p.gain.linearRampToValueAtTime(r,u+a),p.gain.exponentialRampToValueAtTime(1e-4,u+n),d.connect(p),p.connect(l||this.sfxGain),d.start(u),d.stop(u+n+.02)}_noise(t,e,{type:i="bandpass",f0:n=1e3,f1:r=null,q:a=1,attack:o=.003,dest:l=null}={}){const c=this.ctx,h=c.currentTime,u=c.createBufferSource();u.buffer=this.noiseBuf,u.loop=!0;const d=c.createBiquadFilter();d.type=i,d.frequency.setValueAtTime(n,h),d.Q.value=a,r!==null&&d.frequency.exponentialRampToValueAtTime(Math.max(20,r),h+t);const p=c.createGain();p.gain.setValueAtTime(0,h),p.gain.linearRampToValueAtTime(e,h+o),p.gain.exponentialRampToValueAtTime(1e-4,h+t),u.connect(d),d.connect(p),p.connect(l||this.sfxGain),u.start(h),u.stop(h+t+.02)}play(t,{vol:e=1,pitch:i=1}={}){if(!this.unlocked||this.muted)return;const n=this.ctx;n.state==="suspended"&&n.resume();const r=Math.min(1.5,e);switch(t){case"swing":this._noise(.13,.25*r,{f0:1800*i,f1:500*i,q:1.2});break;case"swingHeavy":this._noise(.22,.32*r,{f0:1200*i,f1:250*i,q:1}),this._osc("sine",160*i,70*i,.2,.12*r);break;case"hit":this._osc("sine",190*i,60*i,.14,.5*r),this._noise(.08,.35*r,{type:"lowpass",f0:2500,q:.7}),this._osc("square",900*i,300,.04,.06*r);break;case"hitHeavy":this._osc("sine",130*i,38,.3,.7*r),this._noise(.16,.45*r,{type:"lowpass",f0:1800,f1:300,q:.8}),this._osc("triangle",600*i,120,.1,.12*r);break;case"block":this._osc("square",1100*i,700,.06,.1*r),this._noise(.09,.3*r,{f0:3200,f1:1500,q:2}),this._osc("sine",300,150,.1,.2*r);break;case"jump":this._osc("sine",300*i,620*i,.12,.14*r),this._noise(.08,.08*r,{type:"highpass",f0:2e3});break;case"land":this._noise(.1,.22*r,{type:"lowpass",f0:900*i,f1:200,q:.8}),this._osc("sine",120*i,50,.1,.18*r);break;case"dash":this._noise(.18,.2*r,{type:"highpass",f0:600*i,f1:3e3*i,q:.7});break;case"wall":this._osc("sine",100,35,.3,.6*r),this._noise(.2,.4*r,{type:"lowpass",f0:1200,f1:150});break;case"ko":this._osc("sine",80,22,.9,.9*r),this._noise(.6,.6*r,{type:"lowpass",f0:3e3,f1:100,q:.5}),this._osc("sawtooth",220,40,.5,.15*r);break;case"cast":this._osc("triangle",520*i,1040*i,.25,.18*r),this._osc("sine",780*i,1560*i,.3,.1*r,{detune:8}),this._noise(.25,.1*r,{f0:2500,f1:5e3,q:3});break;case"wave":this._noise(.35,.3*r,{f0:700,f1:2400,q:1.5}),this._osc("sine",300,900,.3,.15*r);break;case"lunge":this._noise(.3,.35*r,{type:"highpass",f0:400,f1:4e3}),this._osc("sawtooth",200,800,.2,.08*r);break;case"slam":this._osc("sine",70,40,.5,.4*r),this._noise(.3,.2*r,{type:"lowpass",f0:600,f1:100});break;case"slamHit":this._osc("sine",90,25,.7,.9*r),this._noise(.45,.6*r,{type:"lowpass",f0:2e3,f1:80});break;case"fire":this._noise(.5,.45*r,{type:"bandpass",f0:400,f1:1800,q:.6}),this._osc("sawtooth",110,60,.4,.12*r);break;case"deny":this._osc("square",220,160,.12,.08*r);break;case"menuMove":this._osc("sine",640*i,640*i,.05,.12*r);break;case"menuConfirm":this._osc("sine",520,520,.08,.14*r),setTimeout(()=>this.unlocked&&!this.muted&&this._osc("sine",780,780,.14,.14*r),70);break;case"menuBack":this._osc("sine",420,300,.14,.12*r);break;case"announce":this._osc("sine",110,108,1.4,.4*r,{attack:.01}),this._osc("sine",220,218,1,.15*r),this._noise(.4,.15*r,{type:"lowpass",f0:800,f1:100});break;case"fight":this._osc("sawtooth",110,55,.6,.25*r),this._noise(.35,.3*r,{type:"bandpass",f0:900,f1:200,q:.8});break;case"soul":this._osc("sine",880,1320,.3,.1*r),this._osc("sine",1320,1760,.4,.06*r);break;case"win":for(let a=0;a<4;a++)setTimeout(()=>this.unlocked&&!this.muted&&this._osc("triangle",[392,494,587,784][a],[392,494,587,784][a],.5,.14*r),a*140);break}}setMusic(t){if(!this.unlocked){this._pendingMusic=t;return}if(this.music&&this.music.key===t||(this.stopMusic(),!t))return;const e=this.ctx,i={menu:[[55,82.4,110,164.8],[49,73.4,98,146.8]],crossroads:[[49,73.4,87.3,146.8],[43.7,65.4,87.3,130.8]],greenpath:[[41.2,61.7,82.4,123.5],[32.7,49,65.4,98]],raincity:[[55,65.4,82.4,130.8],[43.7,65.4,87.3,130.8]]}[t]||[[55,82.4,110],[49,73.4,98]],n=e.createGain();n.gain.value=0,n.connect(this.musicGain);const r=e.createBiquadFilter();r.type="lowpass",r.frequency.value=420,r.Q.value=.8,r.connect(n);const a=e.createOscillator();a.frequency.value=.07;const o=e.createGain();o.gain.value=180,a.connect(o),o.connect(r.frequency),a.start();const l=i[0].map((d,p)=>{const g=e.createOscillator();g.type=p===0?"sine":"sawtooth",g.frequency.value=d,g.detune.value=p%2?6:-6;const v=e.createGain();return v.gain.value=p===0?.5:.18,g.connect(v),v.connect(r),g.start(),{o:g,g:v}});let c=null;if(t==="raincity"){c=e.createBufferSource(),c.buffer=this.noiseBuf,c.loop=!0;const d=e.createBiquadFilter();d.type="bandpass",d.frequency.value=2200,d.Q.value=.4;const p=e.createGain();p.gain.value=.08,c.connect(d),d.connect(p),p.connect(n),c.start()}if(t==="greenpath"){const d=setInterval(()=>{this.music&&this.music.key===t&&!this.muted&&this._osc("sine",1200+Math.random()*800,600,.25,.03,{dest:this.musicGain})},1800);this.music={key:t,bus:n,oscs:l,lfo:a,rain:c,timers:[d]}}else this.music={key:t,bus:n,oscs:l,lfo:a,rain:c,timers:[]};n.gain.linearRampToValueAtTime(1,e.currentTime+2.5);let h=0;const u=setInterval(()=>{!this.music||this.music.key!==t||(h=(h+1)%i.length,i[h].forEach((d,p)=>{l[p]&&l[p].o.frequency.linearRampToValueAtTime(d,e.currentTime+1.5)}))},7e3);this.music.timers.push(u)}stopMusic(){const t=this.music;if(!t)return;this.music=null;const i=this.ctx.currentTime;t.bus.gain.cancelScheduledValues(i),t.bus.gain.setValueAtTime(t.bus.gain.value,i),t.bus.gain.linearRampToValueAtTime(0,i+1.2);for(const n of t.timers)clearInterval(n);setTimeout(()=>{try{t.oscs.forEach(({o:n})=>n.stop()),t.lfo.stop(),t.rain&&t.rain.stop(),t.bus.disconnect()}catch{}},1400)}flushPending(){if(this._pendingMusic!==void 0&&this.unlocked){const t=this._pendingMusic;this._pendingMusic=void 0,this.setMusic(t)}}}const Ac=[8373503,16739194,9167499,16765803],Ve={max:100,substitution:50,gainHit:10,gainTaken:6,gainBlock:3,gainSwing:1,roundStart:20},ii={max:100,blockCostMul:2.2,breakStun:.9,regen:14,afterBreak:60,soulAfterBreak:25},Cr=["#7fc4ff","#ff6b7a","#8be28b","#ffd36b"],Ie=[{id:"wisp",name:"WISP",title:"the Wandering Shade",glyph:"◊",hp:100,speed:7.4,dashSpeed:17,jumpSpeed:12.5,doubleJump:!0,weight:1,scale:1,atkSpeed:1,power:1,palette:{mask:15921642,cloak:1513247,cloakInner:2763320,accent:10212607,weapon:14672618,eye:328968},horns:"twin",weapon:"nail",weaponLen:1.25,body:{head:[1,1,1],cloak:[1,1,1]},special:{type:"projectile",name:"Soul Dart",cost:100,damage:24},blurb:"A small vessel of quiet grace. The lightest feet in the arena and the highest leap.",stats:{power:3,speed:4,vitality:3,reach:3}},{id:"needle",name:"NEEDLE",title:"the Red Thread",glyph:"†",hp:88,speed:8.6,dashSpeed:21,jumpSpeed:13.2,doubleJump:!0,weight:.85,scale:1.05,atkSpeed:1.18,power:.9,palette:{mask:16052200,cloak:9379116,cloakInner:5902106,accent:16739194,weapon:14277087,eye:328968},horns:"crest",weapon:"needle",weaponLen:1.7,body:{head:[.95,1,.95],cloak:[.92,1.06,.92]},special:{type:"lunge",name:"Thread Lunge",cost:100,damage:26},blurb:"Swift and merciless. Strikes faster than any, but a single misstep costs dearly.",stats:{power:2,speed:5,vitality:2,reach:4}},{id:"ember",name:"EMBER",title:"of the Scarlet Troupe",glyph:"♆",hp:100,speed:7,dashSpeed:19,jumpSpeed:12,doubleJump:!0,weight:1,scale:1.08,atkSpeed:1,power:1.05,palette:{mask:15854822,cloak:2361358,cloakInner:11739180,accent:16730666,weapon:13119530,eye:16726826},horns:"flame",weapon:"ember",weaponLen:1.3,body:{head:[1.02,1.04,1],cloak:[1.08,1.02,1.08]},special:{type:"pillar",name:"Scarlet Pillar",cost:100,damage:26},blurb:"A performer of the nightmare troupe. Calls fire from the floor to punish the careless.",stats:{power:3,speed:3,vitality:3,reach:3}},{id:"bulwark",name:"BULWARK",title:"the Unmoved Shell",glyph:"⛨",hp:120,speed:5.6,dashSpeed:14,jumpSpeed:11,doubleJump:!0,weight:1.45,scale:1.22,atkSpeed:.84,power:1.2,palette:{mask:15131094,cloak:1841698,cloakInner:3815239,accent:13215850,weapon:12104878,eye:328968},horns:"curled",weapon:"greatnail",weaponLen:1.55,body:{head:[1.12,1.02,1.08],cloak:[1.3,.98,1.3]},special:{type:"slam",name:"Shell Quake",cost:100,damage:30},blurb:"Slow as stone and twice as stubborn. Shrugs off light blows while winding up the quake.",stats:{power:5,speed:1,vitality:5,reach:3}},{id:"pale",name:"PALE",title:"the Hollow Crown",glyph:"♛",hp:104,speed:6.9,dashSpeed:17,jumpSpeed:12.2,doubleJump:!0,weight:1.1,scale:1.26,atkSpeed:.96,power:1.08,palette:{mask:16184816,cloak:921108,cloakInner:5988211,accent:14280447,weapon:15659253,eye:328968},horns:"tall",weapon:"longnail",weaponLen:1.9,body:{head:[.92,1,.92],cloak:[.9,1.22,.9]},special:{type:"wave",name:"Pale Wave",cost:100,damage:24},blurb:"Tall, silent, crowned in bone. The longest nail in the arena, swung with royal patience.",stats:{power:4,speed:3,vitality:3,reach:5}}];function Lh(s){return Ie.find(t=>t.id===s)}function Ph(s){const t=a=>a/s.atkSpeed,e=a=>Math.round(a*s.power),i=.9+s.weaponLen*.62,n={light1:{id:"light1",kind:"light",anim:"light1",startup:t(.1),active:t(.09),recovery:t(.24),damage:e(5),hitstun:.34,kb:{f:2.6,u:0},reaction:"hit",hit:{fwd:i*.6,up:1,side:0,r:.78},chain:"light2",hitstop:.055,sfx:"swing"},light2:{id:"light2",kind:"light",anim:"light2",startup:t(.09),active:t(.09),recovery:t(.26),damage:e(5),hitstun:.36,kb:{f:3,u:0},reaction:"hit",hit:{fwd:i*.62,up:1,side:0,r:.8},chain:"light3",hitstop:.055,sfx:"swing"},light3:{id:"light3",kind:"light",anim:"light3",startup:t(.1),active:t(.09),recovery:t(.28),damage:e(6),hitstun:.38,kb:{f:3.4,u:0},reaction:"hit",hit:{fwd:i*.6,up:1,side:0,r:.82},chain:"light4",hitstop:.06,sfx:"swing"},light4:{id:"light4",kind:"light",anim:"light4",startup:t(.13),active:t(.1),recovery:t(.44),damage:e(8),hitstun:.4,kb:{f:12,u:4.5},reaction:"launch",hit:{fwd:i*.62,up:1.05,side:0,r:.88},chain:null,hitstop:.08,sfx:"swingHeavy"},lowLight:{id:"lowLight",kind:"light",anim:"lowLight",startup:t(.12),active:t(.1),recovery:t(.4),low:!0,damage:e(7),hitstun:.4,kb:{f:7.5,u:4.2},reaction:"launch",hit:{fwd:i*.6,up:.45,side:0,r:.85},chain:null,hitstop:.07,sfx:"swing"},lowHeavy:{id:"lowHeavy",kind:"heavy",anim:"lowHeavy",startup:t(.15),active:t(.1),recovery:t(.52),low:!0,damage:e(11),hitstun:.5,kb:{f:2.5,u:14.5},reaction:"launch",hit:{fwd:i*.42,up:1.1,side:0,r:.9},chain:null,hitstop:.1,sfx:"swingHeavy"},throw:{id:"throw",kind:"throw",anim:"throw",startup:.03,active:.1,recovery:.64,grab:!0,unblockable:!0,damage:e(11),hitstun:.5,kb:{f:9.5,u:7.5},reaction:"launch",throwTime:.78,releaseAt:.46,hit:{fwd:.95,up:.95,side:0,r:.75},chain:null,hitstop:.09,sfx:"swingHeavy"},heavy:{id:"heavy",kind:"heavy",anim:"heavy",startup:t(.23),active:t(.12),recovery:t(.5),damage:e(12),hitstun:.5,kb:{f:4.5,u:12.5},reaction:"launch",hit:{fwd:i*.55,up:1.15,side:0,r:.95},chain:null,hitstop:.1,sfx:"swingHeavy"},airLight:{id:"airLight",kind:"air",anim:"airLight",startup:t(.08),active:t(.11),recovery:t(.2),damage:e(6),hitstun:.34,kb:{f:4.5,u:2.5},reaction:"hit",hit:{fwd:i*.58,up:.9,side:0,r:.8},chain:null,hitstop:.06,sfx:"swing"},airHeavy:{id:"airHeavy",kind:"air",anim:"airHeavy",startup:t(.11),active:.9,recovery:.16,holdUntilLand:!0,damage:e(10),hitstun:.55,kb:{f:3,u:-13},reaction:"spike",pogo:!0,hit:{fwd:.35,up:-.35,side:0,r:.95},chain:null,hitstop:.09,sfx:"swingHeavy"}},r=s.special;switch(r.type){case"projectile":n.special={id:"special",kind:"special",anim:"cast",startup:.22,active:.05,recovery:.42,damage:e(r.damage),spawn:"projectile",hitstop:.08,sfx:"cast",cost:r.cost,name:r.name,proj:{speed:21,r:.55,life:1.3,kb:{f:8,u:6},reaction:"launch",hitstun:.4,style:"dart"}};break;case"lunge":n.special={id:"special",kind:"special",anim:"lunge",startup:.15,active:.26,recovery:.46,damage:e(r.damage),hitstun:.5,kb:{f:13,u:6},reaction:"launch",moveSpeed:24,hit:{fwd:i*.7,up:1,side:0,r:.9},hitstop:.1,sfx:"lunge",cost:r.cost,name:r.name};break;case"pillar":n.special={id:"special",kind:"special",anim:"conjure",startup:.32,active:.05,recovery:.48,damage:e(r.damage),spawn:"pillar",hitstop:.1,sfx:"cast",cost:r.cost,name:r.name,pillar:{dist:3.4,r:1.25,h:3.2,delay:.18,active:.38,kb:{f:2.5,u:13.5},reaction:"launch",hitstun:.5}};break;case"slam":n.special={id:"special",kind:"special",anim:"slam",startup:.42,active:.05,recovery:.6,armor:!0,damage:e(r.damage),spawn:"shockwave",hitstop:.12,sfx:"slam",cost:r.cost,name:r.name,wave:{maxR:4.2,grow:.28,kb:{f:10,u:8},reaction:"launch",hitstun:.5}};break;case"wave":default:n.special={id:"special",kind:"special",anim:"wave",startup:.2,active:.05,recovery:.44,damage:e(r.damage),spawn:"projectile",hitstop:.08,sfx:"wave",cost:r.cost,name:r.name,proj:{speed:17,r:.95,life:.62,kb:{f:9.5,u:5},reaction:"launch",hitstun:.4,style:"crescent"}};break}for(const a of Object.keys(n)){const o=n[a];o.total=o.startup+o.active+o.recovery}return n}const Rs=[{id:"easy",name:"Easy",react:.5,attackRate:.8,guard:.08,dodge:.06,combo:.3,special:.2,dash:.15,jump:.12,mistake:.4,aggression:.45,sub:.05,throw:.25},{id:"normal",name:"Normal",react:.3,attackRate:1.3,guard:.28,dodge:.2,combo:.6,special:.45,dash:.4,jump:.22,mistake:.18,aggression:.7,sub:.22,throw:.45},{id:"hard",name:"Hard",react:.17,attackRate:1.8,guard:.5,dodge:.38,combo:.85,special:.7,dash:.6,jump:.3,mistake:.08,aggression:.85,sub:.45,throw:.6},{id:"nightmare",name:"Nightmare",react:.08,attackRate:2.4,guard:.7,dodge:.6,combo:1,special:.9,dash:.8,jump:.35,mistake:.02,aggression:1,sub:.7,throw:.7}];function Ih(s){return s=Math.max(0,Math.floor(s)),`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}const mv=["tl","tr","bl","br"],gv=["t1","t2","t3","t4"];class vv{constructor(){this.el=document.getElementById("hud"),this.el.innerHTML="",this.timerEl=document.createElement("div"),this.timerEl.id="timer",this.el.appendChild(this.timerEl),this.waveEl=document.createElement("div"),this.waveEl.id="wave",this.waveEl.className="hidden",this.el.appendChild(this.waveEl),this.waveEl.innerHTML='<div class="w-num"></div><div class="w-tier"></div><div class="w-line"></div>',this.waveNum=this.waveEl.querySelector(".w-num"),this.waveTier=this.waveEl.querySelector(".w-tier"),this.waveLine=this.waveEl.querySelector(".w-line"),this.announceEl=document.createElement("div"),this.announceEl.id="announce",this.el.appendChild(this.announceEl),this.subEl=document.createElement("div"),this.subEl.id="subannounce",this.el.appendChild(this.subEl),this.slots=[],this._announceTimer=null,this._waveKey=""}show(){this.el.classList.remove("hidden")}hide(){this.el.classList.add("hidden"),this.clearAnnounce()}setup(t,e,{survival:i=!1}={}){for(const r of this.slots)r.root.remove(),r.combo.remove();this.slots=[],this.survival=i,this.el.classList.toggle("survival",i),this.timerEl.classList.toggle("hidden",i),this.waveEl.classList.toggle("hidden",!i);const n=t.length;t.forEach((r,a)=>{const o=i?r.isCPU:n>2,l=i?r.isCPU?"s"+r.slot:"tl":n>2?gv[a]:mv[a],c=document.createElement("div");c.className="slot "+l+(o?" small":"");const h=Cr[r.slot],u=r.isCPU?"CPU":"P"+(r.slot+1);c.innerHTML=`
        <div class="name"><span class="tag" style="color:${h}">${u}</span><span>${r.name}</span></div>
        <div class="bar health${o?" small":""}"><div class="fill lag"></div><div class="fill hp"></div></div>
        <div class="bar soul"><div class="fill"></div><div class="seg" style="left:50%"></div></div>
        <div class="bar guard"><div class="fill"></div></div>
        <div class="pips"></div>
        <div class="buffs"></div>`;const d=c.querySelector(".pips");for(let f=0;f<e;f++){const M=document.createElement("div");M.className="pip",d.appendChild(M)}const p=c.querySelector(".fill.hp"),g=c.querySelector(".fill.lag"),v=Math.max(0,r.hp/r.maxHp);p.style.transform=`scaleX(${v})`,g.style.transform=`scaleX(${v})`,this.el.appendChild(c);const m=document.createElement("div");m.className="combo "+l,this.el.appendChild(m),this.slots.push({f:r,root:c,combo:m,corner:l,hp:p,lag:g,soul:c.querySelector(".bar.soul .fill"),soulBar:c.querySelector(".bar.soul"),guard:c.querySelector(".bar.guard .fill"),guardBar:c.querySelector(".bar.guard"),buffs:c.querySelector(".buffs"),pips:Array.from(d.children),lastCombo:r.comboCount>=2&&r.comboTimer>0?r.comboCount:0,lastBuffKey:"",healthBar:c.querySelector(".bar.health")})})}update(t,e){for(const n of this.slots){const r=n.f,a=Math.max(0,r.hp/r.maxHp);n.hp.style.transform=`scaleX(${a})`,n.lag.style.transform=`scaleX(${a})`,n.soul.style.transform=`scaleX(${Math.max(0,Math.min(1,r.soul/100))})`,n.soulBar.classList.toggle("full",r.soul>=r.moves.special.cost),n.soulBar.classList.toggle("half",r.soul>=50&&r.soul<r.moves.special.cost),n.guard.style.transform=`scaleX(${Math.max(0,Math.min(1,r.guard/100))})`,n.guardBar.classList.toggle("low",r.guard<35),n.root.classList.toggle("ko",!r.alive),n.pips.forEach((o,l)=>o.classList.toggle("won",l<r.roundWins)),r.comboCount>=2&&r.comboTimer>0?n.lastCombo!==r.comboCount&&(n.combo.innerHTML=`<b>${r.comboCount}</b> HITS`,n.combo.classList.remove("show"),n.combo.offsetWidth,n.combo.classList.add("show"),n.lastCombo=r.comboCount):n.lastCombo!==0&&(n.combo.classList.remove("show"),n.lastCombo=0),this.updateBuffs(n)}const i=Math.max(0,Math.ceil(t));this.timerEl.textContent=t===1/0?"∞":String(i),this.timerEl.classList.toggle("low",i<=10&&t!==1/0)}updateBuffs(t){const e=t.f,i=e.buffs,n=(i.attack>0?"a":"")+(i.invincible>0?"i":"");if(n!==t.lastBuffKey&&(t.lastBuffKey=n,t.buffs.innerHTML=(i.attack>0?'<div class="buff atk"><span>ATTACK ×1.5</span><i></i></div>':"")+(i.invincible>0?'<div class="buff inv"><span>INVINCIBLE</span><i></i></div>':"")),!n)return;const r=t.buffs.querySelector(".buff.atk i"),a=t.buffs.querySelector(".buff.inv i");r&&e.buffDef.attack&&(r.style.transform=`scaleX(${Math.min(1,i.attack/e.buffDef.attack.duration)})`),a&&e.buffDef.invincible&&(a.style.transform=`scaleX(${Math.min(1,i.invincible/e.buffDef.invincible.duration)})`)}flashHealth(t,e){const i=this.slots.find(n=>n.f===t);i&&(i.healthBar.classList.remove("heal"),e&&(i.healthBar.offsetWidth,i.healthBar.classList.add("heal")))}setWave(t){const e=t.best?t.best.wave:0,i=`${t.wave}|${t.tier}|${t.kills}|${Math.floor(t.elapsed)}|${t.score}|${e}`;i!==this._waveKey&&(this._waveKey=i,this.waveNum.textContent=t.wave>0?`WAVE ${t.wave}`:"SURVIVAL",this.waveTier.textContent=t.wave>0&&["Easy","Normal","Hard"][t.tier]||"",this.waveLine.textContent=`${t.kills} defeated  ·  ${Ih(t.elapsed)}  ·  ${t.score.toLocaleString()} pts${e?`  ·  best ${e}`:""}`)}announce(t,{sub:e="",ko:i=!1,hold:n=1.4}={}){const r=this.announceEl;r.textContent=t,r.classList.remove("show","ko"),r.offsetWidth,r.classList.add("show"),i&&r.classList.add("ko"),this.subEl.textContent=e,this.subEl.classList.toggle("show",!!e),this._announceTimer&&(clearTimeout(this._announceTimer),this._announceTimer=null),n>0&&(this._announceTimer=setTimeout(()=>this.clearAnnounce(),n*1e3))}clearAnnounce(){this.announceEl.classList.remove("show"),this.subEl.classList.remove("show")}sub(t,e=1){this.announceEl.classList.contains("show")&&this._announceTimer||(this.subEl.textContent=t,this.subEl.classList.add("show"),this._subTimer&&clearTimeout(this._subTimer),this._subTimer=setTimeout(()=>{this.announceEl.classList.contains("show")||this.subEl.classList.remove("show")},e*1e3))}}let Aa=null;function Di(s,t=2200){const e=document.getElementById("toast");e.textContent=s,e.classList.add("show"),Aa&&clearTimeout(Aa),Aa=setTimeout(()=>e.classList.remove("show"),t)}const xv=`
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
varying float vA; varying vec3 vC;
void main() {
  vC = aColor; vA = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (420.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`,_v=`
varying float vA; varying vec3 vC;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.25, r) * vA;
  gl_FragColor = vec4(vC * a, a);
}`;class yv{constructor(t,e=2e3){this.max=e,this.pos=new Float32Array(e*3),this.vel=new Float32Array(e*3),this.life=new Float32Array(e),this.maxLife=new Float32Array(e),this.size=new Float32Array(e),this.size0=new Float32Array(e),this.alpha=new Float32Array(e),this.alpha0=new Float32Array(e),this.color=new Float32Array(e*3),this.grav=new Float32Array(e),this.drag=new Float32Array(e),this.shrink=new Uint8Array(e),this.alive=0,this.head=0;const i=new ye;i.setAttribute("position",new Ae(this.pos,3)),i.setAttribute("aSize",new Ae(this.size,1)),i.setAttribute("aAlpha",new Ae(this.alpha,1)),i.setAttribute("aColor",new Ae(this.color,3)),this.geo=i;const n=new Si({vertexShader:xv,fragmentShader:_v,transparent:!0,depthWrite:!1,blending:$e});this.points=new Sg(i,n),this.points.frustumCulled=!1,this.points.renderOrder=10,t.add(this.points),this.scene=t,this._c=new Ut}emit({x:t,y:e,z:i,vx:n=0,vy:r=0,vz:a=0,life:o=.5,size:l=.3,color:c=16777215,alpha:h=1,gravity:u=0,drag:d=0,shrink:p=!0}){const g=this.head;this.head=(this.head+1)%this.max,this.pos[g*3]=t,this.pos[g*3+1]=e,this.pos[g*3+2]=i,this.vel[g*3]=n,this.vel[g*3+1]=r,this.vel[g*3+2]=a,this.life[g]=o,this.maxLife[g]=o,this.size[g]=l,this.size0[g]=l,this.alpha[g]=h,this.alpha0[g]=h,this._c.set(c),this.color[g*3]=this._c.r,this.color[g*3+1]=this._c.g,this.color[g*3+2]=this._c.b,this.grav[g]=u,this.drag[g]=d,this.shrink[g]=p?1:0}burst(t,e,i){const{spread:n=1,speed:r=4,speedVar:a=.5,dir:o=null,dirBias:l=.6,...c}=i;for(let h=0;h<e;h++){let u=Math.random()-.5,d=Math.random()-.5,p=Math.random()-.5;const g=Math.hypot(u,d,p)||1;u/=g,d/=g,p/=g,o&&(u=u*(1-l)+o.x*l,d=d*(1-l)+o.y*l,p=p*(1-l)+o.z*l);const v=r*(1+(Math.random()-.5)*2*a),m={...c};c.sizeVar&&(m.size=c.size*(1+(Math.random()-.5)*2*c.sizeVar)),c.lifeVar&&(m.life=c.life*(1+(Math.random()-.5)*2*c.lifeVar)),this.emit({x:t.x+(Math.random()-.5)*n,y:t.y+(Math.random()-.5)*n,z:t.z+(Math.random()-.5)*n,vx:u*v,vy:d*v,vz:p*v,...m})}}update(t){const e=this.max;for(let i=0;i<e;i++){if(this.life[i]<=0){this.alpha[i]!==0&&(this.alpha[i]=0);continue}this.life[i]-=t;const n=Math.max(0,this.life[i]/this.maxLife[i]),r=this.drag[i]>0?Math.exp(-this.drag[i]*t):1;this.vel[i*3]*=r,this.vel[i*3+1]=this.vel[i*3+1]*r-this.grav[i]*t,this.vel[i*3+2]*=r,this.pos[i*3]+=this.vel[i*3]*t,this.pos[i*3+1]+=this.vel[i*3+1]*t,this.pos[i*3+2]+=this.vel[i*3+2]*t,this.alpha[i]=this.alpha0[i]*(n<.5?n*2:1),this.size[i]=this.shrink[i]?this.size0[i]*(.3+.7*n):this.size0[i],this.life[i]<=0&&(this.alpha[i]=0)}this.geo.attributes.position.needsUpdate=!0,this.geo.attributes.aSize.needsUpdate=!0,this.geo.attributes.aAlpha.needsUpdate=!0,this.geo.attributes.aColor.needsUpdate=!0}clear(){this.life.fill(0),this.alpha.fill(0),this.geo.attributes.aAlpha.needsUpdate=!0}dispose(){this.scene.remove(this.points),this.geo.dispose(),this.points.material.dispose()}}const ne={hitSpark(s,t,e,i=16777215,n=!1){const r=n?26:14;s.burst(t,r,{spread:.25,speed:n?9:6,speedVar:.6,dir:e,dirBias:.35,life:.28,lifeVar:.4,size:n?.5:.34,sizeVar:.5,color:i,gravity:6,drag:3}),s.emit({x:t.x,y:t.y,z:t.z,life:.12,size:n?2.6:1.7,color:16777215,alpha:.9,shrink:!1}),n&&s.emit({x:t.x,y:t.y,z:t.z,life:.22,size:4.5,color:11195647,alpha:.45,shrink:!1})},blockSpark(s,t,e){s.burst(t,10,{spread:.2,speed:5,dir:e,dirBias:.5,life:.22,size:.25,color:10474495,gravity:4,drag:3}),s.emit({x:t.x,y:t.y,z:t.z,life:.15,size:2.2,color:7317759,alpha:.7,shrink:!1})},dust(s,t,e=8,i=9078136){s.burst(t,e,{spread:.5,speed:2.2,speedVar:.6,dir:new R(0,.6,0),dirBias:.3,life:.55,lifeVar:.4,size:.55,sizeVar:.4,color:i,alpha:.35,gravity:-.5,drag:2.5})},dashTrail(s,t,e){s.emit({x:t.x+(Math.random()-.5)*.3,y:t.y+.3+Math.random()*.8,z:t.z+(Math.random()-.5)*.3,life:.3,size:.6,color:e,alpha:.35,drag:2})},soul(s,t,e=6){s.burst(t,e,{spread:.3,speed:1.5,dir:new R(0,1,0),dirBias:.7,life:.8,lifeVar:.3,size:.35,sizeVar:.4,color:10474495,alpha:.8,gravity:-2,drag:1.5})},wallHit(s,t,e){s.burst(t,24,{spread:.6,speed:7,speedVar:.5,dir:e,dirBias:.5,life:.5,lifeVar:.4,size:.5,sizeVar:.5,color:13222576,alpha:.7,gravity:8,drag:2}),s.emit({x:t.x,y:t.y,z:t.z,life:.2,size:4,color:16777215,alpha:.5,shrink:!1})},ko(s,t){s.burst(t,80,{spread:.5,speed:9,speedVar:.6,life:1.2,lifeVar:.5,size:.6,sizeVar:.6,color:16777215,alpha:.9,gravity:3,drag:1.5}),s.burst(t,40,{spread:.5,speed:4,speedVar:.6,life:1.6,lifeVar:.5,size:.9,sizeVar:.6,color:10474495,alpha:.6,gravity:-1,drag:1}),s.emit({x:t.x,y:t.y,z:t.z,life:.5,size:10,color:16777215,alpha:.8,shrink:!1})},fire(s,t,e=6,i=1){for(let n=0;n<e;n++){const r=Math.random()*Math.PI*2,a=Math.random()*i;s.emit({x:t.x+Math.cos(r)*a,y:t.y+Math.random()*.5,z:t.z+Math.sin(r)*a,vx:(Math.random()-.5)*1.5,vy:5+Math.random()*5,vz:(Math.random()-.5)*1.5,life:.5+Math.random()*.4,size:.9+Math.random()*.8,color:Math.random()<.5?16734762:16756794,alpha:.8,drag:1.2})}}};class Mv{constructor(t,e=16777215,i=16){this.max=i,this.samples=[];const n=new ye;this.posArr=new Float32Array(i*2*3),this.colArr=new Float32Array(i*2*3),n.setAttribute("position",new Ae(this.posArr,3)),n.setAttribute("color",new Ae(this.colArr,3));const r=[];for(let a=0;a<i-1;a++){const o=a*2;r.push(o,o+1,o+2,o+1,o+3,o+2)}n.setIndex(r),n.setDrawRange(0,0),this.geo=n,this.mat=new he({vertexColors:!0,transparent:!0,side:Re,depthWrite:!1,blending:$e}),this.mesh=new gt(n,this.mat),this.mesh.frustumCulled=!1,this.mesh.renderOrder=9,this.color=new Ut(e),this.fade=.13,t.add(this.mesh),this.scene=t}push(t,e){this.samples.push({a:t.clone(),b:e.clone(),t:0}),this.samples.length>this.max&&this.samples.shift()}update(t){for(const i of this.samples)i.t+=t;for(;this.samples.length&&this.samples[0].t>this.fade;)this.samples.shift();const e=this.samples.length;for(let i=0;i<e;i++){const n=this.samples[i],r=1-n.t/this.fade,a=i*6;this.posArr[a]=n.a.x,this.posArr[a+1]=n.a.y,this.posArr[a+2]=n.a.z,this.posArr[a+3]=n.b.x,this.posArr[a+4]=n.b.y,this.posArr[a+5]=n.b.z;const o=r*r;this.colArr[a]=this.color.r*o*.35,this.colArr[a+1]=this.color.g*o*.35,this.colArr[a+2]=this.color.b*o*.35,this.colArr[a+3]=this.color.r*o,this.colArr[a+4]=this.color.g*o,this.colArr[a+5]=this.color.b*o}this.geo.setDrawRange(0,e>=2?(e-1)*6:0),this.geo.attributes.position.needsUpdate=!0,this.geo.attributes.color.needsUpdate=!0}clear(){this.samples.length=0,this.geo.setDrawRange(0,0)}dispose(){this.scene.remove(this.mesh),this.geo.dispose(),this.mat.dispose()}}function Sv(s){const t=s.players[0],e=s.connectedPads(),i=Object.keys(t.held).filter(n=>t.held[n]&&n!=="confirm"&&n!=="back");return`<div class="padmon"><h3>Live input</h3><div class="padslot"><div class="dev">${t.deviceLabel}</div><div class="stick">x ${t.x.toFixed(2)}  y ${t.y.toFixed(2)}</div><div class="btns">${i.length?i.map(n=>`<b>${n}</b>`).join(" "):'<span class="dim">no buttons held</span>'}</div><div class="dim">${e.length?e.length+" pad(s) detected":"no pad detected — press any button on a connected controller"}</div></div></div>`}class Dh{constructor(t,e,{monitor:i=!0}={}){this.input=t,this.audio=e,this.monitor=i,this.active=!1,this.row=0,this.col=0,this.capturing=null,this.el=null,this.cells=[]}get rowCount(){return Ii.length+1}mount(t){this.el=document.createElement("div"),this.el.className="ctl",this.el.innerHTML='<div class="ctl-table"><div class="ctl-head"><span>Action</span><span>Keyboard</span><span class="padfam"></span></div><div class="ctl-rows"></div><div class="ctl-foot"><span class="ctl-reset">Reset to defaults</span></div></div><div class="ctl-notes"></div><div class="padmon-host"></div>';const e=this.el.querySelector(".ctl-rows");return this.cells=Ii.map((i,n)=>{const r=document.createElement("div");r.className="ctl-row",r.innerHTML=`<span class="act">${i.name}</span><span class="cell kb"></span><span class="cell pad${i.pad?" fixed":""}"></span>`;const a=r.querySelector(".kb"),o=r.querySelector(".pad");return a.addEventListener("click",l=>{l.stopPropagation(),this.startCapture(n,0)}),o.addEventListener("click",l=>{l.stopPropagation(),this.startCapture(n,1)}),e.appendChild(r),{row:r,kb:a,pad:o}}),this.resetEl=this.el.querySelector(".ctl-reset"),this.resetEl.addEventListener("click",i=>{i.stopPropagation(),this.reset()}),this.el.querySelector(".ctl-notes").innerHTML=cv.map(([i,n])=>`<div><b>${i}</b> ${n}</div>`).join(""),this.monHost=this.el.querySelector(".padmon-host"),t.appendChild(this.el),this.refresh(),this.el}setActive(t){this.active=t,t||this.cancelCapture(),this.refresh()}startCapture(t,e){const i=Ii[t];if(e===1&&i.pad){Di("Movement is the stick / d-pad on a controller"),this.audio.play("deny");return}if(e===1&&!this.input.hasPad()){Di("Connect a controller and press a button on it first"),this.audio.play("deny");return}this.cancelCapture(),this.active=!0,this.row=t,this.col=e,this.capturing={row:t,col:e},this.audio.play("menuConfirm"),this.input.beginCapture(e===0?"keyboard":"pad",n=>this.onCaptured(n)),this.refresh()}onCaptured(t){const e=this.capturing;if(this.capturing=null,!e)return;if(t===null){this.audio.play("menuBack"),this.refresh();return}if(typeof t=="object"){Di(t.error,2600),this.audio.play("deny"),this.refresh();return}const i=Ii[e.row].id,n=e.col===0,r=this.input.bind(n?"keyboard":"pad",i,t);if(!r.ok){Di(r.error,2800),this.audio.play("deny"),this.refresh();return}this.audio.play("menuConfirm");const a=n?ys:o=>xs(o,this.input.padId);r.moved.length&&Di(r.moved.map(o=>`${Eo(o.action)} is now ${a(o.code)}`).join("   ·   "),2800),this.refresh()}cancelCapture(){this.capturing&&(this.capturing=null,this.input.cancelCapture())}reset(){this.cancelCapture(),this.input.resetBindings(),this.audio.play("menuBack"),Di("Controls reset to defaults"),this.refresh()}handle(t){if(!this.active||this.capturing)return null;const e=this.audio;return t.up&&(this.row=(this.row+this.rowCount-1)%this.rowCount,e.play("menuMove"),this.refresh()),t.down&&(this.row=(this.row+1)%this.rowCount,e.play("menuMove"),this.refresh()),(t.left||t.right)&&(this.col=this.col===0?1:0,e.play("menuMove"),this.refresh()),t.confirm&&(this.row===Ii.length?this.reset():this.startCapture(this.row,this.col)),t.back?(this.setActive(!1),"exit"):null}refresh(){if(!this.el)return;const t=this.input,e=t.bindings,i=t.padId;this.el.querySelector(".padfam").textContent=`${Rr(i).family} gamepad`,Ii.forEach((n,r)=>{const a=this.cells[r],o=!!this.capturing&&this.capturing.row===r&&this.capturing.col===0,l=!!this.capturing&&this.capturing.row===r&&this.capturing.col===1,c=Rr(i);let h=Sc(e.keyboard[n.id],ys),u=n.pad?n.pad:Sc(e.pad[n.id],p=>xs(p,i));n.id==="pause"&&(h=["Esc","Enter",...(e.keyboard.pause||[]).map(ys)].join(" / "),u=[c.start,...(e.pad.pause||[]).map(p=>xs(p,i))].join(" / ")),n.id==="jump"&&(u+="  ·  stick ↑"),a.kb.textContent=o?"press a key…":h,a.pad.textContent=l?"press a button…":u,a.kb.classList.toggle("cap",o),a.pad.classList.toggle("cap",l);const d=this.active&&this.row===r;a.kb.classList.toggle("sel",d&&this.col===0),a.pad.classList.toggle("sel",d&&this.col===1),a.row.classList.toggle("selrow",d)}),this.resetEl.classList.toggle("sel",this.active&&this.row===Ii.length),this.el.classList.toggle("active",this.active),this.updateMonitor()}updateMonitor(){if(this.capturing&&this.el){const e=this.cells[this.capturing.row],i=this.capturing.col===0?e.kb:e.pad,n=Math.max(0,Math.ceil(Ah-(this.input.capture?this.input.capture.t:0)));i.textContent=`${this.capturing.col===0?"press a key":"press a button"}… ${n}`}if(!this.monitor||!this.monHost)return;const t=performance.now();this._monT&&t-this._monT<100||(this._monT=t,this.monHost.innerHTML=Sv(this.input))}destroy(){this.cancelCapture(),this.el&&(this.el.remove(),this.el=null)}}let Ra=null;function bv(){if(Ra)return Ra;const s=new Uint8Array([60,60,60,255,125,125,125,255,200,200,200,255,255,255,255,255]),t=new fh(s,4,1,Ke);return t.minFilter=Oe,t.magFilter=Oe,t.generateMipmaps=!1,t.needsUpdate=!0,Ra=t,t}function fr(s,t={}){return new ev({color:s,gradientMap:bv(),...t})}const Rc=new he({color:460556,side:De});function Cs(s,t,e,i=8,n=null){const r=new mh(s),a=n||Math.max(8,s.length*5),o=r.getSpacedPoints(a),l=r.computeFrenetFrames(a,!1),c=[],h=[],u=[];for(let f=0;f<=a;f++){const M=f/a,y=t+(e-t)*Math.pow(M,.85),x=o[f],I=l.normals[f],A=l.binormals[f];for(let C=0;C<=i;C++){const P=C/i*Math.PI*2,S=Math.cos(P)*I.x+Math.sin(P)*A.x,_=Math.cos(P)*I.y+Math.sin(P)*A.y,L=Math.cos(P)*I.z+Math.sin(P)*A.z;c.push(x.x+S*y,x.y+_*y,x.z+L*y),h.push(S,_,L)}}for(let f=0;f<a;f++)for(let M=0;M<i;M++){const y=f*(i+1)+M,x=y+i+1;u.push(y,y+1,x,x,y+1,x+1)}const d=c.length/3;c.push(o[0].x,o[0].y,o[0].z),h.push(0,-1,0);for(let f=0;f<i;f++)u.push(d,f+1,f);const p=c.length/3,g=o[a];c.push(g.x,g.y,g.z),h.push(0,1,0);const v=a*(i+1);for(let f=0;f<i;f++)u.push(p,v+f,v+f+1);const m=new ye;return m.setAttribute("position",new $t(c,3)),m.setAttribute("normal",new $t(h,3)),m.setIndex(u),m}function Uh(s){switch(s){case"twin":return[{pts:[[.19,.3,0],[.31,.52,-.02],[.4,.78,-.05],[.41,1,-.09],[.36,1.16,-.12]],r0:.145,r1:.02}];case"crest":return[{pts:[[.2,.3,.02],[.36,.5,-.2],[.5,.65,-.5],[.58,.72,-.85],[.62,.74,-1.05]],r0:.135,r1:.015},{pts:[[.05,.4,-.05],[.08,.6,-.3],[.1,.66,-.5]],r0:.07,r1:.012}];case"curled":{const t=[],e=[.42,.02,-.12];for(let i=0;i<=8;i++){const n=i/8,r=.38-.19*n,a=1.25+3.7*n;t.push([.3+.2*n,e[1]+r*Math.sin(a),e[2]+r*Math.cos(a)])}return[{pts:t,r0:.16,r1:.035}]}case"tall":return[{pts:[[.17,.33,0],[.26,.7,-.03],[.33,1.15,-.06],[.33,1.6,-.08],[.28,1.95,-.1]],r0:.135,r1:.015},{pts:[[.27,.78,-.04],[.45,1,-.1],[.58,1.25,-.16],[.64,1.45,-.2]],r0:.075,r1:.012}];case"flame":return[{pts:[[.12,.38,.02],[.2,.7,-.25],[.26,.95,-.5],[.28,1.05,-.62]],r0:.11,r1:.015},{pts:[[.3,.26,-.05],[.48,.5,-.35],[.6,.62,-.6],[.64,.66,-.72]],r0:.1,r1:.015},{pts:[[.38,.05,-.12],[.58,.15,-.4],[.68,.2,-.58]],r0:.09,r1:.012},{pts:[[0,.42,-.02],[0,.72,-.3],[0,.88,-.5]],r0:.08,r1:.012,noMirror:!0}];default:return Uh("twin")}}function wv(s,t){const e={nail:{w:.1,t:.028,curve:0},needle:{w:.05,t:.022,curve:0},greatnail:{w:.17,t:.045,curve:0},longnail:{w:.085,t:.03,curve:0},ember:{w:.11,t:.03,curve:.1}}[s]||{w:.1,t:.028,curve:0},i=10,n=new Xo,r=[],a=[];for(let l=0;l<=i;l++){const c=l/i,h=t*c,u=e.w/2*(c<.15?.8+c*1.5:1)*(1-Math.pow(Math.max(0,(c-.6)/.4),1.6)),d=e.curve*Math.sin(Math.PI*c)*t;r.push([d-u,h]),a.push([d+u,h])}n.moveTo(r[0][0],r[0][1]);for(let l=1;l<=i;l++)n.lineTo(r[l][0],r[l][1]);n.lineTo(0,t+.001);for(let l=i;l>=0;l--)n.lineTo(a[l][0],a[l][1]);n.closePath();const o=new Fr(n,{depth:e.t,bevelEnabled:!1});return o.translate(0,0,-e.t/2),o.computeVertexNormals(),{geo:o,cfg:e}}function Nh(s){const t=s.palette,e=s.body||{head:[1,1,1],cloak:[1,1,1]},i=new Se;i.name="vessel_"+s.id;const n=fr(t.mask),r=fr(t.cloak,{side:Re}),a=fr(t.cloakInner,{side:De}),o=fr(t.weapon,s.weapon==="ember"?{emissive:new Ut(4852234),emissiveIntensity:1}:{}),l=new he({color:t.eye}),c=[n,r,a,o];for(const T of c)T.userData.baseEmissive=T.emissive?T.emissive.clone():new Ut(0,0,0);const h=e.cloak[1],u=.12+.88*h,d=new Se;d.rotation.order="YXZ",i.add(d);const p=[[.15,.03],[.2,0],[.27,-.12],[.33,-.3],[.4,-.55],[.46,-.76],[.49,-.88]].map(T=>new lt(T[0],T[1])),g=new Nr(p,28);{const T=g.attributes.position;for(let et=0;et<T.count;et++){const j=T.getX(et),ut=T.getY(et),ot=T.getZ(et);if(ut<-.5){const Dt=Math.atan2(ot,j),mt=Math.min(1,(-ut-.5)/.38),b=1+(.07*Math.sin(Dt*7+1.3)+.035*Math.sin(Dt*3-.4))*mt;T.setXYZ(et,j*b,ut-.06*mt*Math.abs(Math.sin(Dt*7+1.3)),ot*b)}}g.computeVertexNormals()}const v=new Se;v.position.set(0,u,0),d.add(v);const m=new gt(g,r);m.castShadow=!0,m.receiveShadow=!1,m.scale.set(e.cloak[0],h,e.cloak[2]),v.add(m);const f=new gt(g,a);f.scale.copy(m.scale).multiplyScalar(.985),v.add(f);const M=new Xe(.21,16,12),y=new gt(M,r);y.scale.set(e.cloak[0]*1.1,.7,e.cloak[2]*1),y.position.y=-.02,y.castShadow=!0,v.add(y);const x=new Xe(.1,12,10),I=T=>{const et=new Se;et.position.set(T*.12*e.cloak[0],.3,0),d.add(et);const j=new gt(x,r);j.scale.set(.95,.7,1.35),j.position.set(0,-.23,.05),j.castShadow=!0,et.add(j);const ut=new gt(new je(.045,.06,.26,8),r);return ut.position.set(0,-.12,0),et.add(ut),et},A=I(-1),C=I(1),P=new Se;P.position.set(0,u+.05,0),d.add(P);const S=e.head,_=new Xe(.45,36,26),L=new gt(_,n);L.scale.set(1*S[0],.86*S[1],.82*S[2]),L.position.set(0,.36,0),L.castShadow=!0,P.add(L);const O=new gt(_,Rc);O.scale.copy(L.scale).multiplyScalar(1.055),O.position.copy(L.position),P.add(O);const F=new Xe(1,14,12);for(const T of[-1,1]){const et=new gt(F,l);et.scale.set(.115,.19,.07),et.position.set(T*.165*S[0],.36-.02,.33*S[2]),et.rotation.set(.1,T*.4,T*-.16),P.add(et)}const G=new Se;G.position.set(0,.36,0),G.scale.set(S[0],S[1],S[2]),P.add(G);for(const T of Uh(s.horns)){const et=T.noMirror?[1]:[1,-1];for(const j of et){const ut=T.pts.map(E=>new R(E[0]*j,E[1],E[2])),ot=Cs(ut,T.r0,T.r1,9),Dt=new gt(ot,n);Dt.castShadow=!0,G.add(Dt);const mt=Cs(ut,T.r0*1.18+.02,T.r1+.03,9);G.add(new gt(mt,Rc))}}const q=new Vo(.07,.25,4,10),W=new Xe(.085,12,10),Z=T=>{const et=new Se;et.rotation.order="YXZ",et.position.set(T*.3*e.cloak[0],u-.1,.04),d.add(et);const j=new gt(q,r);j.position.set(0,-.19,0),j.castShadow=!0,et.add(j);const ut=new gt(W,r);return ut.position.set(0,-.4,0),ut.castShadow=!0,et.add(ut),et},V=Z(-1),ct=Z(1);V.rotation.z=.22,ct.rotation.z=-.3;const ht=new Se;ht.position.set(0,-.4,0),ht.rotation.order="XYZ",ct.add(ht);const Mt=s.weaponLen,{geo:zt,cfg:jt}=wv(s.weapon,Mt),Y=new gt(zt,o);Y.castShadow=!0,ht.add(Y);const nt=s.weapon==="needle"?new je(.075,.075,.03,12):new Fi(jt.w*2.6+.06,.05,jt.t*2+.03),St=new gt(nt,r);St.position.y=.01,ht.add(St);const at=new gt(new je(.03,.028,.2,8),r);at.position.y=-.1,ht.add(at),ht.rotation.x=Math.PI+1.25,ht.rotation.y=.35;const Lt=new xe;Lt.position.set(0,.12,0),ht.add(Lt);const kt=new xe;kt.position.set(0,Mt,0),ht.add(kt),i.scale.setScalar(s.scale);const Nt={body:d,head:P,armL:V,armR:ct,weapon:ht,cloak:v,legL:A,legR:C},qt={};for(const T of Object.keys(Nt)){const et=Nt[T];qt[T]={p:[et.position.x,et.position.y,et.position.z],r:[et.rotation.x,et.rotation.y,et.rotation.z]}}return{group:i,nodes:Nt,rest:qt,mats:c,bladeBase:Lt,bladeTip:kt,setFlash:(T,et=null)=>{for(const j of c)j.emissive&&(j.emissive.copy(j.userData.baseEmissive),T>0&&(et?j.emissive.lerp(et,T):j.emissive.addScalar(T*.9)))},dispose:()=>{i.traverse(T=>{T.geometry&&T.geometry.dispose()});for(const T of c)T.dispose();l.dispose()},neckY:u,height:(u+.8)*s.scale}}const Ms=["body","head","armL","armR","weapon","cloak","legL","legR"],kh=Object.fromEntries(Ms.map((s,t)=>[s,t])),Lr=6,Ln=Ms.length*Lr;function Cc(s){return s*s*(3-2*s)}function Ev(s){const t=new Float32Array(Ln);for(const e of Object.keys(s)){const i=kh[e];if(i===void 0)throw new Error("Unknown rig node "+e);const n=s[e],r=i*Lr;t[r]=n.x||0,t[r+1]=n.y||0,t[r+2]=n.z||0,t[r+3]=n.px||0,t[r+4]=n.py||0,t[r+5]=n.pz||0}return t}function Zt(s,t,e={}){const i=t.map(([n,r])=>({t:n,data:r instanceof Float32Array?r:Ev(r)}));return{name:s,keys:i,duration:i[i.length-1].t,loop:!!e.loop,ease:e.ease||"smooth"}}class Oh{constructor(t){this.nodes=t.nodes,this.rest=t.rest,this.clip=null,this.time=0,this.speed=1,this.current=new Float32Array(Ln),this.target=new Float32Array(Ln),this.blendFrom=null,this.blendT=0,this.blendDur=.08,this.extra=new Float32Array(Ln)}play(t,{restart:e=!1,blend:i=.08,speed:n=1,time:r=0}={}){if(t){if(this.clip===t&&!e){this.speed=n;return}this.blendFrom=Float32Array.from(this.current),this.blendT=0,this.blendDur=i,this.clip=t,this.time=r,this.speed=n}}get done(){return!!this.clip&&!this.clip.loop&&this.time>=this.clip.duration}evaluate(t,e,i){const n=t.duration;t.loop?e=n>0?(e%n+n)%n:0:e=Math.min(Math.max(e,0),n);const r=t.keys;let a=0;for(;a<r.length-1&&r[a+1].t<e;)a++;const o=r[a],l=r[Math.min(a+1,r.length-1)],c=l.t-o.t;let h=c>0?(e-o.t)/c:1;h=Math.min(1,Math.max(0,h)),t.ease==="smooth"&&(h=Cc(h));for(let u=0;u<Ln;u++)i[u]=o.data[u]+(l.data[u]-o.data[u])*h}update(t){if(this.clip){if(this.time+=t*this.speed,this.evaluate(this.clip,this.time,this.target),this.blendFrom){this.blendT+=t;const e=Cc(Math.min(1,this.blendT/Math.max(1e-4,this.blendDur)));for(let i=0;i<Ln;i++)this.current[i]=this.blendFrom[i]+(this.target[i]-this.blendFrom[i])*e;e>=1&&(this.blendFrom=null)}else this.current.set(this.target);this.apply()}}apply(){const t=this.current,e=this.extra;for(let i=0;i<Ms.length;i++){const n=this.nodes[Ms[i]],r=this.rest[Ms[i]],a=i*Lr;n.rotation.set(r.r[0]+t[a]+e[a],r.r[1]+t[a+1]+e[a+1],r.r[2]+t[a+2]+e[a+2]),n.position.set(r.p[0]+t[a+3]+e[a+3],r.p[1]+t[a+4]+e[a+4],r.p[2]+t[a+5]+e[a+5])}}setExtra(t,e,i){const n=kh[t],r={x:0,y:1,z:2,px:3,py:4,pz:5}[e];this.extra[n*Lr+r]=i}}const It=-1.25,Tt=-.35;function Fh(s){const t={};t.idle=Zt("idle",[[0,{body:{py:0},head:{x:0},armL:{z:0},armR:{z:0},cloak:{x:0},weapon:{x:0}}],[1.2,{body:{py:.025},head:{x:-.04},armL:{z:.06},armR:{z:-.06},cloak:{x:.03},weapon:{x:.05}}],[2.4,{body:{py:0},head:{x:0},armL:{z:0},armR:{z:0},cloak:{x:0},weapon:{x:0}}]],{loop:!0}),t.walk=Zt("walk",[[0,{legL:{x:.55},legR:{x:-.55},body:{py:0,x:.06},armL:{x:-.25},armR:{x:.25},cloak:{x:-.08}}],[.15,{legL:{x:0},legR:{x:0},body:{py:.045,x:.06},armL:{x:0},armR:{x:0},cloak:{x:-.08}}],[.3,{legL:{x:-.55},legR:{x:.55},body:{py:0,x:.06},armL:{x:.25},armR:{x:-.25},cloak:{x:-.08}}],[.45,{legL:{x:0},legR:{x:0},body:{py:.045,x:.06},armL:{x:0},armR:{x:0},cloak:{x:-.08}}],[.6,{legL:{x:.55},legR:{x:-.55},body:{py:0,x:.06},armL:{x:-.25},armR:{x:.25},cloak:{x:-.08}}]],{loop:!0}),t.dash=Zt("dash",[[0,{body:{x:.1}}],[.08,{body:{x:.42,py:-.05},cloak:{x:-.55},armL:{x:.7,z:.3},armR:{x:.6},legL:{x:-.5},legR:{x:.6},head:{x:-.2}}],[.3,{body:{x:.42,py:-.05},cloak:{x:-.55},armL:{x:.7,z:.3},armR:{x:.6},legL:{x:-.5},legR:{x:.6},head:{x:-.2}}]]),t.dashBack=Zt("dashBack",[[0,{body:{x:-.1}}],[.08,{body:{x:-.3,py:-.03},cloak:{x:.35},armL:{x:-.5,z:.4},armR:{x:-.5},legL:{x:.4},legR:{x:-.3},head:{x:.15}}],[.3,{body:{x:-.3,py:-.03},cloak:{x:.35},armL:{x:-.5,z:.4},armR:{x:-.5},legL:{x:.4},legR:{x:-.3},head:{x:.15}}]]);for(const[n,r]of[["sidestepL",1],["sidestepR",-1]])t[n]=Zt(n,[[0,{body:{z:.1*r}}],[.1,{body:{z:.38*r,py:-.06},cloak:{z:-.3*r},legL:{z:.3*r},legR:{z:.3*r},head:{z:-.15*r},armL:{z:.5},armR:{z:-.5}}],[.32,{body:{z:.38*r,py:-.06},cloak:{z:-.3*r},legL:{z:.3*r},legR:{z:.3*r},head:{z:-.15*r},armL:{z:.5},armR:{z:-.5}}]]);t.jump=Zt("jump",[[0,{body:{x:.1}}],[.12,{legL:{x:-.7},legR:{x:.4},armL:{z:.9},armR:{z:-.7,x:-.4},cloak:{x:.35},head:{x:-.1},body:{x:-.05}}],[.35,{legL:{x:-.5},legR:{x:.3},armL:{z:.8},armR:{z:-.6,x:-.3},cloak:{x:.3},head:{x:-.1},body:{x:-.05}}]]),t.fall=Zt("fall",[[0,{armL:{z:1.1},armR:{z:-1},legL:{x:.3},legR:{x:-.2},cloak:{x:-.25},body:{x:.08},head:{x:.1}}],[.35,{armL:{z:1.25},armR:{z:-1.15},legL:{x:.1},legR:{x:0},cloak:{x:-.32},body:{x:.1},head:{x:.12}}],[.7,{armL:{z:1.1},armR:{z:-1},legL:{x:.3},legR:{x:-.2},cloak:{x:-.25},body:{x:.08},head:{x:.1}}]],{loop:!0}),t.land=Zt("land",[[0,{body:{py:-.1,x:.2},armL:{z:.5},armR:{z:-.5},legL:{x:.3},legR:{x:-.3},head:{x:.15}}],[.18,{}]]),t.guard=Zt("guard",[[0,{body:{x:.05}}],[.1,{body:{x:.12,py:-.06},armR:{x:-1.25,y:.95},weapon:{x:-Math.PI,y:Tt},armL:{x:-.6,y:-.5},head:{x:.1},legL:{x:.2},legR:{x:-.2}}]]),t.block=Zt("block",[[0,{body:{x:.3,py:-.08},armR:{x:-1.1,y:.8},weapon:{x:-Math.PI,y:Tt},armL:{x:-.5,y:-.4},head:{x:.2}}],[1,{body:{x:.12,py:-.06},armR:{x:-1.25,y:.95},weapon:{x:-Math.PI,y:Tt},armL:{x:-.6,y:-.5},head:{x:.1}}]]),t.hit=Zt("hit",[[0,{head:{x:-.4},body:{x:-.28},armL:{x:-.6,z:.5},armR:{x:-.3,z:-.4},cloak:{x:.2},legL:{x:-.2},legR:{x:.2}}],[.6,{head:{x:-.25},body:{x:-.15},armL:{x:-.4,z:.4},armR:{x:-.2,z:-.3},cloak:{x:.1}}],[1,{}]]),t.launched=Zt("launched",[[0,{body:{x:-1},armL:{z:1.2},armR:{z:-1.2},legL:{x:-.5},legR:{x:.4},head:{x:-.3},cloak:{x:.5}}],[.4,{body:{x:-1.15},armL:{z:.6},armR:{z:-.6},legL:{x:.3},legR:{x:-.4},head:{x:-.2},cloak:{x:.65}}],[.8,{body:{x:-1},armL:{z:1.2},armR:{z:-1.2},legL:{x:-.5},legR:{x:.4},head:{x:-.3},cloak:{x:.5}}]],{loop:!0}),t.spiked=Zt("spiked",[[0,{body:{x:.9},armL:{z:1.2,x:-1},armR:{z:-1.2,x:-1},legL:{x:.4},legR:{x:.4},head:{x:.3},cloak:{x:-.6}}],[.5,{body:{x:.95},armL:{z:1,x:-1.2},armR:{z:-1,x:-1.2},legL:{x:.2},legR:{x:.5},head:{x:.3},cloak:{x:-.7}}],[1,{body:{x:.9},armL:{z:1.2,x:-1},armR:{z:-1.2,x:-1},legL:{x:.4},legR:{x:.4},head:{x:.3},cloak:{x:-.6}}]],{loop:!0});const e={body:{x:-1.42,py:.26},head:{x:.25},armL:{z:1,x:-.4},armR:{z:-.9,x:-.3},legL:{x:-.2},legR:{x:.25},cloak:{x:.15},weapon:{x:.3}};t.knockdown=Zt("knockdown",[[0,e],[1,{...e,body:{x:-1.45,py:.24}}]]),t.getup=Zt("getup",[[0,e],[.45,{body:{x:-.6,py:.05},head:{x:.1},armL:{z:.4,x:-.8},armR:{z:-.4,x:-.6},legL:{x:.5},legR:{x:-.3}}],[1,{}]]),t.ko=Zt("ko",[[0,{body:{x:-1,z:.1},armL:{z:1.3},armR:{z:-1.3},head:{x:-.4},cloak:{x:.5}}],[1,{body:{x:-1.5,z:.25,py:.22},head:{x:.3,z:.2},armL:{z:1.2,x:-.3},armR:{z:-1.1,x:-.2},legL:{x:-.1},legR:{x:.3},cloak:{x:.1},weapon:{x:.5}}]]),t.win=Zt("win",[[0,{armR:{x:-2.9,y:.1},weapon:{x:It,y:Tt},body:{py:0},head:{x:-.15},armL:{z:.3}}],[.8,{armR:{x:-2.75,y:.1},weapon:{x:It,y:Tt},body:{py:.04},head:{x:-.2},armL:{z:.35}}],[1.6,{armR:{x:-2.9,y:.1},weapon:{x:It,y:Tt},body:{py:0},head:{x:-.15},armL:{z:.3}}]],{loop:!0}),t.intro=Zt("intro",[[0,{body:{x:.25,py:-.1},head:{x:.3},armR:{x:-.3}}],[.9,{body:{x:-.05},head:{x:-.1},armR:{x:-2.8,y:.1},weapon:{x:It,y:Tt},armL:{z:.3}}],[1.4,{}]]);const i=(n,r)=>{const a=n.startup,o=n.active,l=n.recovery,c=n.total;switch(r){case"forehand":return Zt(n.id,[[0,{armR:{x:-1,y:1.25},weapon:{x:It,y:Tt},body:{y:.42},head:{y:-.3},armL:{x:-.3,z:.3}}],[a*.85,{armR:{x:-1.5,y:1.45},weapon:{x:It,y:Tt},body:{y:.48},head:{y:-.3},armL:{x:-.3,z:.3}}],[a+o,{armR:{x:-1.5,y:-1.35},weapon:{x:It,y:Tt},body:{y:-.42},head:{y:.25},cloak:{y:.2},armL:{x:.2,z:.3}}],[a+o+l*.35,{armR:{x:-1.25,y:-1.5},weapon:{x:It,y:Tt},body:{y:-.45},head:{y:.2},cloak:{y:.15},armL:{x:.2,z:.3}}],[c,{}]]);case"backhand":return Zt(n.id,[[0,{armR:{x:-1.2,y:-1.45},weapon:{x:It,y:Tt},body:{y:-.4},head:{y:.25},armL:{x:.2,z:.3}}],[a*.85,{armR:{x:-1.5,y:-1.55},weapon:{x:It,y:Tt},body:{y:-.45},head:{y:.25},armL:{x:.2,z:.3}}],[a+o,{armR:{x:-1.5,y:1.4},weapon:{x:It,y:Tt},body:{y:.45},head:{y:-.3},cloak:{y:-.2},armL:{x:-.3,z:.3}}],[a+o+l*.35,{armR:{x:-1.25,y:1.5},weapon:{x:It,y:Tt},body:{y:.45},head:{y:-.25},cloak:{y:-.15},armL:{x:-.3,z:.3}}],[c,{}]]);case"overhead":return Zt(n.id,[[0,{armR:{x:-2.9,y:.15},weapon:{x:It,y:Tt},body:{x:-.15},head:{x:-.1},armL:{x:-.8,z:.4}}],[a*.85,{armR:{x:-3,y:.2},weapon:{x:It,y:Tt},body:{x:-.2},head:{x:-.15},armL:{x:-.8,z:.4}}],[a+o,{armR:{x:-.35,y:-.1},weapon:{x:It,y:Tt},body:{x:.38,py:-.07},head:{x:.2},cloak:{x:-.2},armL:{x:.3,z:.4},legL:{x:.3},legR:{x:-.3}}],[a+o+l*.4,{armR:{x:-.2,y:-.1},weapon:{x:It,y:Tt},body:{x:.3,py:-.05},head:{x:.15},armL:{x:.3,z:.4},legL:{x:.3},legR:{x:-.3}}],[c,{}]]);case"uppercut":return Zt(n.id,[[0,{armR:{x:.7,y:.3},weapon:{x:It,y:Tt},body:{x:.3,py:-.12},head:{x:.15},armL:{x:-.4,z:.5}}],[a*.9,{armR:{x:.9,y:.35},weapon:{x:It,y:Tt},body:{x:.35,py:-.15},head:{x:.2},armL:{x:-.4,z:.5}}],[a+o,{armR:{x:-2.9,y:-.2},weapon:{x:It,y:Tt},body:{x:-.3,py:.08},head:{x:-.25},cloak:{x:.25},armL:{x:.3,z:.6},legL:{x:-.3},legR:{x:.4}}],[a+o+l*.3,{armR:{x:-2.6,y:-.2},weapon:{x:It,y:Tt},body:{x:-.2,py:.04},head:{x:-.2},cloak:{x:.15},armL:{x:.2,z:.5}}],[c,{}]]);case"airSlash":return Zt(n.id,[[0,{armR:{x:-1.1,y:1.2},weapon:{x:It,y:Tt},body:{y:.4,x:.2},legL:{x:-.6},legR:{x:.3},armL:{z:.8}}],[a,{armR:{x:-1.5,y:1.4},weapon:{x:It,y:Tt},body:{y:.45,x:.25},legL:{x:-.6},legR:{x:.3},armL:{z:.8}}],[a+o,{armR:{x:-1.5,y:-1.3},weapon:{x:It,y:Tt},body:{y:-.4,x:.25},legL:{x:-.6},legR:{x:.3},armL:{z:.8}}],[c,{armR:{x:-1,y:-1},weapon:{x:It,y:Tt},body:{y:-.2,x:.1},legL:{x:-.4},legR:{x:.2},armL:{z:.9}}]]);case"downstab":return Zt(n.id,[[0,{armR:{x:-2.6,y:.1},weapon:{x:It,y:Tt},body:{x:.2},armL:{z:1},legL:{x:-.4},legR:{x:-.2}}],[a,{armR:{x:.25,y:0},weapon:{x:It,y:Tt},body:{x:.4,py:.12},head:{x:.35},legL:{x:-1},legR:{x:-.9},armL:{z:1.1,x:-.5},cloak:{x:-.4}}],[c,{armR:{x:.25,y:0},weapon:{x:It,y:Tt},body:{x:.4,py:.12},head:{x:.35},legL:{x:-1},legR:{x:-.9},armL:{z:1.1,x:-.5},cloak:{x:-.4}}]]);case"cast":return Zt(n.id,[[0,{armL:{x:-.5,y:.4},body:{y:.3},armR:{x:.4,y:.2}}],[a,{armL:{x:-1.65,y:-.1,z:0},body:{y:-.25,x:.15},armR:{x:.6,y:.3},head:{x:-.05}}],[a+o+l*.4,{armL:{x:-1.5,y:-.1},body:{y:-.2,x:.1},armR:{x:.5,y:.3}}],[c,{}]]);case"lunge":return Zt(n.id,[[0,{armR:{x:-.6,y:.4},weapon:{x:It,y:Tt},body:{y:.4,x:.1},armL:{x:-.4,z:.4}}],[a,{armR:{x:-1.62,y:-.05},weapon:{x:It,y:Tt},body:{y:-.1,x:.5},head:{x:-.3},cloak:{x:-.5},legL:{x:.6},legR:{x:-.7},armL:{x:.8,z:.4}}],[a+o,{armR:{x:-1.62,y:-.05},weapon:{x:It,y:Tt},body:{y:-.1,x:.5},head:{x:-.3},cloak:{x:-.5},legL:{x:.6},legR:{x:-.7},armL:{x:.8,z:.4}}],[c,{}]]);case"conjure":return Zt(n.id,[[0,{armL:{x:-1.2,z:.3},armR:{x:-1.2,z:-.3},weapon:{x:It,y:Tt},body:{x:.05}}],[a*.7,{armL:{x:-2.7,z:.3},armR:{x:-2.7,z:-.3},weapon:{x:It,y:Tt},body:{x:-.15},head:{x:-.3},cloak:{x:.2}}],[a+o,{armL:{x:-1,z:.4},armR:{x:-1,z:-.4},weapon:{x:It,y:Tt},body:{x:.3,py:-.08},head:{x:.2}}],[c,{}]]);case"slam":return Zt(n.id,[[0,{armR:{x:-2.9},weapon:{x:It,y:Tt},body:{x:-.2},armL:{x:-1,z:.5}}],[a*.5,{armR:{x:-3.1},weapon:{x:It,y:Tt},body:{x:-.25,py:.4},legL:{x:-.8},legR:{x:-.8},armL:{x:-1.2,z:.6},cloak:{x:.35}}],[a+o,{armR:{x:-.3},weapon:{x:It,y:Tt},body:{x:.45,py:-.18},head:{x:.25},legL:{x:.3},legR:{x:-.3},armL:{x:.3,z:.5},cloak:{x:-.25}}],[a+o+l*.5,{armR:{x:-.3},weapon:{x:It,y:Tt},body:{x:.35,py:-.12},head:{x:.2},armL:{x:.3,z:.5}}],[c,{}]]);case"spin":return Zt(n.id,[[0,{armR:{x:-1.3,y:1.55},weapon:{x:It,y:Tt},body:{y:.9,x:.1},head:{y:-.4},armL:{x:-.4,z:.4},legL:{x:.2},legR:{x:-.2}}],[a*.9,{armR:{x:-1.55,y:1.65},weapon:{x:It,y:Tt},body:{y:1,x:.1,py:.08},head:{y:-.4},armL:{x:-.4,z:.4},legL:{x:-.6},legR:{x:-.6}}],[a+o,{armR:{x:-1.55,y:-1.6},weapon:{x:It,y:Tt},body:{y:-1,x:.15,py:.18},head:{y:.35},cloak:{y:.35,x:-.2},armL:{x:.3,z:.5},legL:{x:-.7},legR:{x:-.7}}],[a+o+l*.4,{armR:{x:-1.2,y:-1.7},weapon:{x:It,y:Tt},body:{y:-.9,x:.2,py:0},head:{y:.3},cloak:{y:.2},armL:{x:.3,z:.5},legL:{x:.2},legR:{x:-.2}}],[c,{}]]);case"throw":{const h=n.releaseAt,u=n.throwTime;return Zt(n.id,[[0,{armL:{x:-1.2,y:.2},armR:{x:-1.2,y:-.2},weapon:{x:It,y:Tt},body:{x:.25},head:{x:.1}}],[a,{armL:{x:-1.6,y:.1},armR:{x:-1.6,y:-.1},weapon:{x:It,y:Tt},body:{x:.35,py:-.05},head:{x:.15}}],[h*.75,{armL:{x:-2.6,z:.3},armR:{x:-2.6,z:-.3},weapon:{x:It,y:Tt},body:{x:-.25,py:.05},head:{x:-.3},cloak:{x:.2}}],[h+.08,{armL:{x:-.4,z:.4},armR:{x:-.4,z:-.4},weapon:{x:It,y:Tt},body:{x:.45,py:-.1},head:{x:.3},cloak:{x:-.3},legL:{x:.3},legR:{x:-.3}}],[u,{}]])}case"sweep":return Zt(n.id,[[0,{armR:{x:-.9,y:1.3},weapon:{x:It,y:Tt},body:{py:-.25,x:.3,y:.5},legL:{x:.6},legR:{x:-.6},armL:{x:-.5,z:.5}}],[a,{armR:{x:-1,y:1.5},weapon:{x:It,y:Tt},body:{py:-.3,x:.35,y:.6},legL:{x:.6},legR:{x:-.6},armL:{x:-.5,z:.5}}],[a+o,{armR:{x:-1,y:-1.4},weapon:{x:It,y:Tt},body:{py:-.3,x:.35,y:-.6},cloak:{y:.3},legL:{x:.6},legR:{x:-.6},armL:{x:.2,z:.5}}],[a+o+l*.4,{armR:{x:-.8,y:-1.5},weapon:{x:It,y:Tt},body:{py:-.2,x:.3,y:-.5},legL:{x:.4},legR:{x:-.4},armL:{x:.2,z:.5}}],[c,{}]]);case"rising":return Zt(n.id,[[0,{armR:{x:.8,y:.3},weapon:{x:It,y:Tt},body:{py:-.3,x:.4},legL:{x:.5},legR:{x:-.5},head:{x:.2},armL:{x:-.4,z:.5}}],[a,{armR:{x:.9,y:.35},weapon:{x:It,y:Tt},body:{py:-.35,x:.45},legL:{x:.5},legR:{x:-.5},head:{x:.25},armL:{x:-.4,z:.5}}],[a+o,{armR:{x:-3,y:-.1},weapon:{x:It,y:Tt},body:{py:.25,x:-.3},head:{x:-.3},legL:{x:-.8},legR:{x:-.8},cloak:{x:.3},armL:{x:.3,z:.6}}],[a+o+l*.3,{armR:{x:-2.7,y:-.1},weapon:{x:It,y:Tt},body:{py:.05,x:-.15},head:{x:-.2},armL:{x:.2,z:.5}}],[c,{}]]);case"wave":return Zt(n.id,[[0,{armR:{x:-1.2,y:1.5},weapon:{x:It,y:Tt},body:{y:.6},head:{y:-.4},armL:{x:-.3,z:.3}}],[a,{armR:{x:-1.55,y:1.6},weapon:{x:It,y:Tt},body:{y:.65},head:{y:-.4},armL:{x:-.3,z:.3}}],[a+o+.08,{armR:{x:-1.55,y:-1.5},weapon:{x:It,y:Tt},body:{y:-.6},head:{y:.3},cloak:{y:.3},armL:{x:.2,z:.3}}],[c,{}]]);default:return i(n,"forehand")}};return t.light1=i(s.light1,"forehand"),t.light2=i(s.light2,"backhand"),t.light3=i(s.light3,"overhead"),t.light4=i(s.light4,"spin"),t.lowLight=i(s.lowLight,"sweep"),t.lowHeavy=i(s.lowHeavy,"rising"),t.throw=i(s.throw,"throw"),t.heavy=i(s.heavy,"uppercut"),t.airLight=i(s.airLight,"airSlash"),t.airHeavy=i(s.airHeavy,"downstab"),t.special=i(s.special,s.special.anim),t}const zh=13,Pn=[{id:"crossroads",name:"Forgotten Crossroads",desc:"A lantern-lit cavern of old stone and older silence.",swatch:"linear-gradient(90deg,#1b2033,#3a3f52,#ffb070)",music:"crossroads"},{id:"greenpath",name:"Verdant Hollow",desc:"Moss, giant caps, and acid pools glowing beneath the vines.",swatch:"linear-gradient(90deg,#0b2a1a,#3f8c7a,#7cff6a)",music:"greenpath"},{id:"raincity",name:"City of Rain",desc:"Towers of blue glass weep over a slick stone plaza.",swatch:"linear-gradient(90deg,#060912,#141b2e,#7fb0ff)",music:"raincity"}];function Us(s){let t=s>>>0;return()=>(t=t*1664525+1013904223>>>0,t/4294967296)}function Bh(s,t,e=5){const i=document.createElement("canvas");i.width=i.height=s;const n=i.getContext("2d");t(n,s);const r=new bg(i);return r.wrapS=r.wrapT=br,r.repeat.set(e,e),r.colorSpace=ze,r.anisotropy=8,r}function Ls({base:s,dark:t,light:e,mortar:i,n=6,seed:r=1,noise:a=.12}){const o=Us(r);return Bh(512,(l,c)=>{l.fillStyle=i,l.fillRect(0,0,c,c);const h=c/n;for(let p=0;p<n;p++)for(let g=0;g<n;g++){const v=g%2*h*.5,m=(p*h+v)%c,f=g*h,M=o();l.fillStyle=M<.3?t:M>.7?e:s,l.fillRect(m+3,f+3,h-6,h-6),m+h>c&&l.fillRect(m-c+3,f+3,h-6,h-6),l.strokeStyle="rgba(0,0,0,0.25)",l.lineWidth=1.5,l.beginPath(),l.moveTo(m+o()*h,f+o()*h),l.lineTo(m+o()*h,f+o()*h),l.stroke()}const u=l.getImageData(0,0,c,c),d=u.data;for(let p=0;p<d.length;p+=4){const g=(o()-.5)*255*a;d[p]+=g,d[p+1]+=g,d[p+2]+=g}l.putImageData(u,0,0)})}function Lc({base:s,blots:t,n:e=70,seed:i=3,noise:n=.1}){const r=Us(i);return Bh(512,(a,o)=>{a.fillStyle=s,a.fillRect(0,0,o,o);for(let h=0;h<e;h++){const u=12+r()*50,d=r()*o,p=r()*o,g=a.createRadialGradient(d,p,0,d,p,u),v=t[Math.floor(r()*t.length)];g.addColorStop(0,v),g.addColorStop(1,"rgba(0,0,0,0)"),a.fillStyle=g,a.fillRect(d-u,p-u,u*2,u*2);for(const[m,f]of[[-o,0],[o,0],[0,-o],[0,o]]){const M=a.createRadialGradient(d+m,p+f,0,d+m,p+f,u);M.addColorStop(0,v),M.addColorStop(1,"rgba(0,0,0,0)"),a.fillStyle=M,a.fillRect(d+m-u,p+f-u,u*2,u*2)}}const l=a.getImageData(0,0,o,o),c=l.data;for(let h=0;h<c.length;h+=4){const u=(r()-.5)*255*n;c[h]+=u,c[h+1]+=u,c[h+2]+=u}a.putImageData(l,0,0)},4)}class Br{constructor(t,e,i){this.scene=t,this.renderer=e,this.particles=i,this.group=new Se,t.add(this.group),this.radius=zh,this.disposables=[],this.t=0}track(t){return this.disposables.push(t),t}addFloor(t,e){const i=new gt(new bi(this.radius+1.2,80),t);i.rotation.x=-Math.PI/2,i.receiveShadow=!0,this.group.add(i);const n=new gt(new bi(90,64),new pe({color:e,roughness:1}));return n.rotation.x=-Math.PI/2,n.position.y=-.03,n.receiveShadow=!0,this.group.add(n),i}addRim(t,e){const i=this.radius+.45,n=new gt(new je(i,i+.2,1.1,80,1,!0),t);n.position.y=.55,n.receiveShadow=!0,n.castShadow=!0,this.group.add(n);const r=new gt(new on(i+.02,.14,8,90),new pe({color:e,roughness:.7}));r.rotation.x=Math.PI/2,r.position.y=1.1,r.castShadow=!0,this.group.add(r);const a=new gt(new zi(this.radius-.12,this.radius,90),new he({color:16777215,transparent:!0,opacity:.08,depthWrite:!1}));a.rotation.x=-Math.PI/2,a.position.y=.01,this.group.add(a)}addSun(t,e,i){const n=new sv(t,e);n.position.copy(i),n.castShadow=!0,n.shadow.mapSize.set(2048,2048);const r=18;return Object.assign(n.shadow.camera,{left:-r,right:r,top:r,bottom:-r,near:1,far:80}),n.shadow.camera.updateProjectionMatrix(),n.shadow.bias=-4e-4,n.shadow.normalBias=.03,this.group.add(n),this.group.add(n.target),this.sun=n,n}update(t){this.t+=t}dispose(){this.scene.remove(this.group),this.group.traverse(t=>{if(t.geometry&&t.geometry.dispose(),t.material){const e=Array.isArray(t.material)?t.material:[t.material];for(const i of e)i.map&&i.map.dispose(),i.dispose()}t.isLight&&t.dispose&&t.dispose()});for(const t of this.disposables)t.dispose&&t.dispose();this.scene.fog=null,this.scene.background=new Ut(329226)}}class Tv extends Br{constructor(t,e,i){super(t,e,i),t.background=new Ut(658452),t.fog=new Zn(658452,.026);const n=Ls({base:"#3a3f52",dark:"#262a3a",light:"#4a506a",mortar:"#15171f",n:7,seed:11}),r=new pe({map:n,roughness:.85,metalness:.05});this.addFloor(r,921624);const a=Ls({base:"#2b2f40",dark:"#1d2030",light:"#383d52",mortar:"#101218",n:10,seed:5});a.repeat.set(16,1),this.addRim(new pe({map:a,roughness:.9}),4870250),this.group.add(new zr(7309001,657938,.55)),this.addSun(11451647,1.5,new R(6,22,10));const o=new pe({color:2764352,roughness:.95}),l=new pe({color:2040370,roughness:.95}),c=Us(77);for(let d=0;d<22;d++){const p=d/22*Math.PI*2+c()*.2,g=17+c()*9,v=3+c()*8,m=Math.cos(p)*g,f=Math.sin(p)*g,M=[new R(m,-.5,f),new R(m+c()*.6,v*.5,f+c()*.6),new R(m+c()*.8,v,f+c()*.8)],y=new gt(Cs(M,1.1+c()*1.2,.15,10),c()<.5?o:l);y.castShadow=!0,y.receiveShadow=!0,this.group.add(y)}for(let d=0;d<26;d++){const p=c()*Math.PI*2,g=6+c()*26,v=2+c()*6,m=Math.cos(p)*g,f=Math.sin(p)*g,M=[new R(m,15,f),new R(m+c()*.4,15-v*.5,f+c()*.4),new R(m+c()*.5,15-v,f+c()*.5)],y=new gt(Cs(M,.6+c()*1,.08,8),l);this.group.add(y)}const h=new gt(new bi(60,48),new pe({color:1316383,roughness:1}));h.rotation.x=Math.PI/2,h.position.y=15.5,this.group.add(h);for(let d=0;d<5;d++){const p=d/5*Math.PI*2+.4,g=new gt(new on(5.5,.7,8,28,Math.PI),l);g.position.set(Math.cos(p)*30,.5,Math.sin(p)*30),g.rotation.y=-p+Math.PI/2,this.group.add(g)}this.lanterns=[];const u=new he({color:16761482});for(let d=0;d<6;d++){const p=d/6*Math.PI*2+.3,g=Math.cos(p)*15.6,v=Math.sin(p)*15.6,m=new gt(new je(.04,.04,9.5,6),o);m.position.set(g,10.25,v),this.group.add(m);const f=new gt(new Yn(.45,0),u);f.position.set(g,5.2,v),this.group.add(f);const M=new gt(new Yn(.6,0),new pe({color:3814208,roughness:.8,wireframe:!0}));M.position.copy(f.position),this.group.add(M);const y=new ln(16756848,55,16,2);y.position.set(g,5,v),this.group.add(y),this.lanterns.push({light:y,body:f,phase:c()*6})}for(let d=0;d<4;d++){const p=d/4*Math.PI*2+Math.PI/4,g=new ln(5930976,25,14,2);g.position.set(Math.cos(p)*11,1.2,Math.sin(p)*11),this.group.add(g)}}update(t){super.update(t);for(const e of this.lanterns)e.light.intensity=55+Math.sin(this.t*7+e.phase)*6+Math.sin(this.t*13.7+e.phase)*3;if(Math.random()<.5){const e=Math.random()*Math.PI*2,i=Math.random()*20;this.particles.emit({x:Math.cos(e)*i,y:Math.random()*9,z:Math.sin(e)*i,vx:(Math.random()-.5)*.3,vy:.15+Math.random()*.2,vz:(Math.random()-.5)*.3,life:5,size:.18,color:9413832,alpha:.35,shrink:!1})}}}class Av extends Br{constructor(t,e,i){super(t,e,i),t.background=new Ut(530202),t.fog=new Zn(797218,.028);const n=Lc({base:"#1d4a30",blots:["#2f7a45","#3d9a5a","#1a3a26","#5fb36b"],n:90,seed:21});this.addFloor(new pe({map:n,roughness:.95}),663316);const r=Lc({base:"#22412c",blots:["#2f5a3c","#19301f","#3a6a45"],n:50,seed:8});r.repeat.set(12,1),this.addRim(new pe({map:r,roughness:.95}),4950613),this.group.add(new zr(10479288,399374,.7)),this.addSun(14221284,1.3,new R(-8,20,6));const a=Us(31),o=new pe({color:13621440,roughness:.9}),l=new pe({color:4164730,roughness:.6}),c=new pe({color:5939416,roughness:.6}),h=new he({color:13172696});this.glows=[];for(let f=0;f<14;f++){const M=f/14*Math.PI*2+a()*.3,y=16.5+a()*10,x=3+a()*6,I=1.6+a()*2.6,A=Math.cos(M)*y,C=Math.sin(M)*y,P=new gt(new je(I*.22,I*.32,x,12),o);P.position.set(A,x/2,C),P.castShadow=!0,this.group.add(P);const S=new gt(new Xe(I,22,14,0,Math.PI*2,0,Math.PI/2),a()<.7?l:c);S.scale.set(1,.55,1),S.position.set(A,x,C),S.castShadow=!0,this.group.add(S);for(let _=0;_<5;_++){const L=a()*Math.PI*2,O=a()*I*.8,F=new gt(new Xe(.12+a()*.14,8,6),h),G=Math.sqrt(Math.max(0,I*I-O*O))*.55;F.position.set(A+Math.cos(L)*O,x+G,C+Math.sin(L)*O),this.group.add(F)}if(f%3===0){const _=new ln(8191898,18,12,2);_.position.set(A,x-.6,C),this.group.add(_),this.glows.push({l:_,phase:a()*6,base:18})}}const u=new Xo;u.moveTo(0,0),u.quadraticCurveTo(1.6,1.5,0,4.5),u.quadraticCurveTo(-1.6,1.5,0,0);const d=new Fr(u,{depth:.06,bevelEnabled:!1}),p=new pe({color:3115599,roughness:.8,side:Re});for(let f=0;f<26;f++){const M=a()*Math.PI*2,y=17+a()*12,x=new gt(d,p),I=1+a()*1.6;x.scale.setScalar(I),x.position.set(Math.cos(M)*y,a()*3,Math.sin(M)*y),x.rotation.set(-.4+a()*.8,a()*Math.PI*2,(a()-.5)*.6),x.castShadow=!0,this.group.add(x)}const g=new pe({color:2578746,roughness:.9});for(let f=0;f<12;f++){const M=a()*Math.PI*2,y=8+a()*18,x=Math.cos(M)*y,I=Math.sin(M)*y,A=[],C=5,P=7+a()*7;for(let _=0;_<=C;_++)A.push(new R(x+Math.sin(_*1.3+f)*.8,17-P*_/C,I+Math.cos(_*1.1+f)*.8));const S=new gt(Cs(A,.2,.05,7),g);this.group.add(S)}const v=new gt(new bi(60,48),new pe({color:730136,roughness:1}));v.rotation.x=Math.PI/2,v.position.y=17.5,this.group.add(v);const m=new he({color:8191850,transparent:!0,opacity:.85});this.pools=[];for(let f=0;f<5;f++){const M=f/5*Math.PI*2+.9,y=17.5+a()*3,x=Math.cos(M)*y,I=Math.sin(M)*y,A=new gt(new bi(1.8+a()*2,24),m);A.rotation.x=-Math.PI/2,A.position.set(x,.02,I),this.group.add(A);const C=new ln(8191850,30,14,2);C.position.set(x,1,I),this.group.add(C),this.pools.push({x,z:I,l:C,phase:a()*6})}}update(t){super.update(t);for(const e of this.glows)e.l.intensity=e.base+Math.sin(this.t*2+e.phase)*5;for(const e of this.pools)e.l.intensity=30+Math.sin(this.t*3+e.phase)*6,Math.random()<.15&&this.particles.emit({x:e.x+(Math.random()-.5)*2,y:.2,z:e.z+(Math.random()-.5)*2,vy:1+Math.random(),life:1.2,size:.25,color:10485632,alpha:.5});if(Math.random()<.7){const e=Math.random()*Math.PI*2,i=Math.random()*18;this.particles.emit({x:Math.cos(e)*i,y:Math.random()*6,z:Math.sin(e)*i,vx:(Math.random()-.5)*.4,vy:.3+Math.random()*.4,vz:(Math.random()-.5)*.4,life:6,size:.22,color:11075504,alpha:.4,shrink:!1})}}}class Rv extends Br{constructor(t,e,i){super(t,e,i),t.background=new Ut(395538),t.fog=new Zn(659488,.017);const n=Ls({base:"#1a2238",dark:"#121829",light:"#243052",mortar:"#0a0e18",n:8,seed:42,noise:.08}),r=new pe({map:n,roughness:.28,metalness:.2});this.addFloor(r,461330);const a=Ls({base:"#1c2440",dark:"#141a2e",light:"#283458",mortar:"#0a0e18",n:10,seed:9,noise:.08});a.repeat.set(16,1),this.addRim(new pe({map:a,roughness:.5,metalness:.1}),3820152),this.group.add(new zr(4878248,329485,.5)),this.addSun(11059455,1.1,new R(-10,24,8));const o=Us(99),l=new pe({color:1317678,roughness:.7,metalness:.1}),c=new pe({color:1778752,roughness:.7}),h=new Fi(.5,.9,.12),u=new he({color:8368383}),d=new xg(h,u,900);let p=0;const g=new xe;this.towers=[];for(let x=0;x<26;x++){const I=x/26*Math.PI*2+o()*.2,A=24+o()*22,C=4+o()*5,P=4+o()*5,S=12+o()*30,_=Math.cos(I)*A,L=Math.sin(I)*A,O=new gt(new Fi(C,S,P),l);if(O.position.set(_,S/2-.5,L),O.rotation.y=Math.PI/2-I,this.group.add(O),o()<.6){const q=new gt(new kr(Math.min(C,P)*.55,4+o()*6,6),c);q.position.set(_,S+2,L),q.rotation.y=Math.PI/2-I,this.group.add(q)}const F=Math.max(1,Math.floor(C/1.4)),G=Math.floor(S/2.2);for(let q=0;q<F;q++)for(let W=0;W<G;W++){if(o()<.45||p>=900)continue;const Z=-C/2+.7+q*1.4,V=1.5+W*2.2;g.position.set(Z,V-S/2,-P/2-.02),g.rotation.set(0,0,0),g.updateMatrix(),O.updateMatrixWorld(!0),g.matrix.premultiply(O.matrixWorld),d.setMatrixAt(p++,g.matrix)}}d.count=p,d.instanceMatrix.needsUpdate=!0,this.group.add(d);const v=new pe({color:2370116,roughness:.6,metalness:.3}),m=new he({color:12574975});this.lamps=[];for(let x=0;x<8;x++){const I=x/8*Math.PI*2+Math.PI/8,A=Math.cos(I)*(this.radius+1.9),C=Math.sin(I)*(this.radius+1.9),P=new gt(new je(.09,.14,3.6,8),v);P.position.set(A,1.8,C),P.castShadow=!0,this.group.add(P);const S=new gt(new on(.5,.06,6,12,Math.PI),v);S.position.set(A,3.6,C),S.rotation.y=-I+Math.PI/2,this.group.add(S);const _=new gt(new Xe(.26,12,10),m);_.position.set(A-Math.cos(I)*.5,3.5,C-Math.sin(I)*.5),this.group.add(_);const L=new ln(9419519,40,13,2);L.position.copy(_.position),this.group.add(L),this.lamps.push({light:L,phase:o()*6})}const f=new gt(new Xe(3,16,12),new he({color:10470655,transparent:!0,opacity:.5}));f.position.set(-30,30,-40),this.group.add(f);const M=900;this.rainN=M,this.rainPos=new Float32Array(M*6),this.rainVel=new Float32Array(M);for(let x=0;x<M;x++)this.resetDrop(x,!0);const y=new ye;y.setAttribute("position",new Ae(this.rainPos,3)),this.rain=new yg(y,new ph({color:10468576,transparent:!0,opacity:.3})),this.rain.frustumCulled=!1,this.group.add(this.rain)}resetDrop(t,e){const i=Math.random()*Math.PI*2,n=Math.sqrt(Math.random())*34,r=Math.cos(i)*n,a=Math.sin(i)*n,o=e?Math.random()*26:24+Math.random()*4,l=t*6;this.rainPos[l]=r,this.rainPos[l+1]=o,this.rainPos[l+2]=a,this.rainPos[l+3]=r+.15,this.rainPos[l+4]=o-.7,this.rainPos[l+5]=a,this.rainVel[t]=18+Math.random()*8}update(t){super.update(t);const e=this.rainPos;for(let i=0;i<this.rainN;i++){const n=i*6,r=this.rainVel[i]*t;e[n+1]-=r,e[n+4]-=r,e[n]+=t*2.5,e[n+3]+=t*2.5,e[n+4]<0&&(Math.hypot(e[n],e[n+2])<this.radius+1&&Math.random()<.35&&this.particles.emit({x:e[n],y:.05,z:e[n+2],vy:1.5,life:.25,size:.2,color:10468576,alpha:.45}),this.resetDrop(i,!1))}this.rain.geometry.attributes.position.needsUpdate=!0;for(const i of this.lamps)i.light.intensity=40+Math.sin(this.t*9+i.phase)*2.5}}function Cv(s,t,e,i){switch(s){case"greenpath":return new Av(t,e,i);case"raincity":return new Rv(t,e,i);case"crossroads":default:return new Tv(t,e,i)}}class Lv extends Br{constructor(t,e,i){super(t,e,i),t.background=new Ut(460815),t.fog=new Zn(460815,.03);const n=Ls({base:"#262a3a",dark:"#1b1e2a",light:"#30354a",mortar:"#0f1118",n:8,seed:3}),r=new gt(new bi(40,48),new pe({map:n,roughness:.9}));r.rotation.x=-Math.PI/2,r.receiveShadow=!0,this.group.add(r),this.group.add(new zr(9413887,657938,.6)),this.addSun(13161727,1.6,new R(4,14,10)),this.pedestals=[]}setPedestals(t){for(const i of this.pedestals)this.group.remove(i.mesh),i.mesh.geometry.dispose(),i.mesh.material.dispose(),this.group.remove(i.light);this.pedestals=[];const e=t<=2?5.5:4.2;for(let i=0;i<t;i++){const n=(i-(t-1)/2)*e,r=new gt(new je(1.4,1.6,.35,32),new pe({color:3817301,roughness:.7}));r.position.set(n,.17,0),r.receiveShadow=!0,r.castShadow=!0,this.group.add(r);const a=new ln(10474495,20,9,2);a.position.set(n,3.5,2),this.group.add(a),this.pedestals.push({x:n,mesh:r,light:a})}}update(t){if(super.update(t),Math.random()<.4){const e=Math.random()*Math.PI*2,i=Math.random()*14;this.particles.emit({x:Math.cos(e)*i,y:Math.random()*6,z:Math.sin(e)*i,vy:.2,life:5,size:.18,color:9413832,alpha:.3,shrink:!1})}}}class Pv{constructor(t){this.cam=t,this.normal=new R(0,0,1),this.pos=new R(0,4,16),this.look=new R(0,1.2,0),this.right=new R(1,0,0),this.forward=new R(0,0,-1),this.shakeAmp=0,this.shakeT=0,this.zoom=1,this.zoomTarget=1,this.zoomT=0,this.keepFocus=!1,this.initialized=!1,this._tmp=new R,this._tmp2=new R}shake(t){this.shakeAmp=Math.max(this.shakeAmp,t)}punch(t=.62,e=.7){this.zoomTarget=t,this.zoomT=e}snap(){this.initialized=!1}update(t,e,i){const n=e.filter(S=>S.alive||this.keepFocus&&S===i);let r=n.length?n:e;if(!r.length)return;if(r.length>2&&i&&i.alive){const S=[i];i.target&&i.target.alive&&S.push(i.target);const _=S.reduce((O,F)=>O+F.pos.x,0)/S.length,L=S.reduce((O,F)=>O+F.pos.z,0)/S.length;r=r.filter(O=>S.includes(O)||Math.hypot(O.pos.x-_,O.pos.z-L)<9)}const a=this._tmp.set(0,0,0);for(const S of r)a.add(S.pos);a.multiplyScalar(1/r.length);let o=0,l=0;for(let S=0;S<r.length;S++){l=Math.max(l,r[S].pos.y);for(let _=S+1;_<r.length;_++){const L=r[S].pos.x-r[_].pos.x,O=r[S].pos.z-r[_].pos.z;o=Math.max(o,Math.hypot(L,O))}}const c=this._tmp2.copy(this.normal);let h=null;if(r.length===2?h=[r[0],r[1]]:i&&i.target&&i.target.alive&&i.alive&&(h=[i,i.target]),h){const S=h[1].pos.x-h[0].pos.x,_=h[1].pos.z-h[0].pos.z,L=Math.hypot(S,_);L>.3&&(c.set(-_/L,0,S/L),c.dot(this.normal)<0&&c.negate())}const u=n.length>2,d=this.initialized?1-Math.exp(-(u?2.2:4.5)*t):1;this.normal.lerp(c,d).setY(0).normalize();const p=ed.degToRad(this.cam.fov),g=this.cam.aspect||1.6,v=Math.tan(p/2)*g,m=(o*.5+2.6)/v;let f=Math.max(9.5,m*1.08+3.5);f=Math.min(f,34),this.zoomT>0?this.zoomT-=t:this.zoomTarget=1,this.zoom+=(this.zoomTarget-this.zoom)*(1-Math.exp(-8*t)),f*=this.zoom;const M=2+o*.09+l*.35+(u?.5:0),y=1.1+l*.35+(u?.15:0),x=this._tmp2.copy(a).addScaledVector(this.normal,f).setY(M),I=a.clone().setY(a.y*.3+y),A=this.initialized?1-Math.exp(-7*t):1;this.pos.lerp(x,A),this.look.lerp(I,A),this.initialized=!0;let C=0,P=0;this.shakeAmp>.001&&(this.shakeT+=t*60,C=(Math.random()-.5)*this.shakeAmp,P=(Math.random()-.5)*this.shakeAmp,this.shakeAmp*=Math.exp(-9*t)),this.cam.position.copy(this.pos),this.cam.lookAt(this.look),this.cam.updateMatrixWorld(!0),this.cam.position.addScaledVector(this._tmp.setFromMatrixColumn(this.cam.matrixWorld,0),C*.6),this.cam.position.y+=P*.6,this.cam.updateMatrixWorld(!0),this.right.setFromMatrixColumn(this.cam.matrixWorld,0).setY(0).normalize(),this.forward.copy(this.normal).negate()}}class Hr{constructor(t){this.cam=t,this.t=0,this.radius=14,this.height=5,this.lookY=1.5,this.speed=.12}update(t){this.t+=t*this.speed,this.cam.position.set(Math.sin(this.t)*this.radius,this.height,Math.cos(this.t)*this.radius),this.cam.lookAt(0,this.lookY,0)}}const k={INTRO:"intro",IDLE:"idle",WALK:"walk",DASH:"dash",SIDESTEP:"sidestep",AIR:"air",LAND:"land",ATTACK:"attack",GUARD:"guard",BLOCKSTUN:"blockstun",HITSTUN:"hitstun",LAUNCHED:"launched",KNOCKDOWN:"knockdown",GETUP:"getup",KO:"ko",WIN:"win",THROWING:"throwing",THROWN:"thrown"},Iv=32,pr=new R(0,1,0),Pc=.18,Dv=.6,_e=new R,Uv=new R,Ki=new R,$i=new R;let Nv=1;function To(){return{x:0,y:0,jump:!1,jumpHeld:!1,light:!1,heavy:!1,special:!1,throw:!1,guard:!1,stepIn:!1,stepOut:!1,target:!1}}class Ao{constructor({char:t,slot:e,isCPU:i,scene:n,world:r,team:a}){this.id=Nv++,this.char=t,this.slot=e,this.isCPU=i,this.team=a===void 0?e:a,this.scene=n,this.world=r,this.color=Ac[e],this.moves=Ph(t),this.clips=Fh(this.moves),this.model=Nh(t),this.anim=new Oh(this.model),this.group=new Se,this.group.add(this.model.group),n.add(this.group),this.radius=.55*t.scale,this.trail=new Mv(n,t.palette.accent);const o=new zi(.5*t.scale,.64*t.scale,40),l=new he({color:this.color,transparent:!0,opacity:.75,depthWrite:!1});this.ring=new gt(o,l),this.ring.rotation.x=-Math.PI/2,this.ring.position.y=.03,this.group.add(this.ring),this.arrow=new gt(new kr(.16*t.scale,.36*t.scale,3),new he({color:this.color,transparent:!0,opacity:.9,depthWrite:!1})),this.arrowPivot=new Se,this.arrowPivot.position.y=.04,this.group.add(this.arrowPivot),this.arrow.rotation.x=Math.PI/2,this.arrow.position.z=.9*t.scale,this.arrowPivot.add(this.arrow);const c=new bi(.5*t.scale,24),h=new he({color:0,transparent:!0,opacity:.35,depthWrite:!1});this.blob=new gt(c,h),this.blob.rotation.x=-Math.PI/2,this.blob.position.y=.02,n.add(this.blob),this.pos=new R,this.vel=new R,this.facing=new R(0,0,1),this.visualYaw=0,this.target=null,this.maxHp=t.hp,this.hp=t.hp,this.soul=Ve.roundStart,this.guard=ii.max,this.roundWins=0,this.state=k.IDLE,this.stateT=0,this.attack=null,this.buffer={},this.invuln=0,this.armor=!1,this.airJumps=0,this.airAttacks=0,this.airHeavyUsed=!1,this.juggle=0,this.wallBounced=!1,this.comboCount=0,this.comboTimer=0,this.comboDamage=0,this.flash=0,this.flashColor=null,this.hitstunDur=.3,this.lastTap={t:-1,dir:0},this.prevY=0,this.sidestepDir=new R,this.dashDir=new R,this.grounded=!0,this.holdingBack=!1,this.wantsGetup=!1,this.alive=!0,this.lastHitBy=null,this.lastHitTime=-10,this.hitEventId=0,this.throwVictim=null,this.thrower=null,this.throwT=0,this.targetLock=0,this.buffs={attack:0,invincible:0},this.buffDef={attack:null,invincible:null},this._buffGlow=!1,this.deadT=0,this.gangHits=0,this.comboOwner=null,this.anim.play(this.clips.idle),this.anim.update(0)}get name(){return this.char.name}get damageMul(){return this.buffs.attack>0&&this.buffDef.attack?this.buffDef.attack.mul:1}get invincible(){return this.buffs.invincible>0}scaleDamage(t){const e=this.damageMul;return e===1?t:Math.max(1,Math.round(t*e))}applyPowerup(t,e){t.heal&&(this.hp=Math.min(this.maxHp,this.hp+Math.round(this.maxHp*t.heal))),t.duration&&(this.buffs[t.id]=Math.max(this.buffs[t.id]||0,t.duration),this.buffDef[t.id]=t),this.flash=1,this.flashColor=new Ut(t.color),e&&t.id==="invincible"&&(this.invuln=Math.max(this.invuln,0))}setSlot(t){this.slot=t,this.color=Ac[t],this.ring.material.color.set(this.color),this.arrow.material.color.set(this.color)}setMaxHp(t){this.maxHp=t,this.hp=t}get airborne(){return this.pos.y>.001||this.vel.y>.001}get canAct(){return this.state===k.IDLE||this.state===k.WALK||this.state===k.LAND}get inHitState(){return this.state===k.HITSTUN||this.state===k.LAUNCHED||this.state===k.KNOCKDOWN||this.state===k.KO||this.state===k.THROWN}get guarding(){return this.state===k.GUARD||this.state===k.BLOCKSTUN||this.state===k.IDLE||this.state===k.LAND||this.state===k.WALK&&this.holdingBack}reset(t,e){this.pos.copy(t),this.vel.set(0,0,0),this.facing.copy(e).setY(0).normalize(),this.visualYaw=Math.atan2(this.facing.x,this.facing.z),this.hp=this.maxHp,this.soul=Math.max(this.soul,Ve.roundStart),this.guard=ii.max,this.alive=!0,this.state=k.INTRO,this.stateT=0,this.attack=null,this.buffer={},this.invuln=0,this.armor=!1,this.airJumps=0,this.airAttacks=0,this.airHeavyUsed=!1,this.juggle=0,this.wallBounced=!1,this.comboCount=0,this.comboTimer=0,this.flash=0,this.lastHitBy=null,this.lastHitTime=-10,this.throwVictim=null,this.thrower=null,this.buffs.attack=0,this.buffs.invincible=0,this._buffGlow=!1,this.deadT=0,this.targetLock=0,this.gangHits=0,this.comboOwner=null,this.wantsGetup=!1,this._bounced=!1,this.jumpCut=!1,this.dashShort=!1,this.trail.clear(),this.anim.play(this.clips.intro,{restart:!0,blend:0}),this.model.setFlash(0),this.group.visible=!0,this.blob.visible=!0,this.group.scale.setScalar(1),this.syncTransform()}setState(t){this.state!==t&&(this.state=t,this.stateT=0,t!==k.ATTACK&&(this.attack=null,this.armor=!1),t!==k.THROWING&&(this.throwVictim=null),(t===k.IDLE||t===k.WALK)&&(this.juggle=0,this.wallBounced=!1,this.gangHits=0,this.comboOwner=null))}bufferPress(t,e){for(const i of["light","heavy","special","throw","jump","stepIn","stepOut","target"])t[i]&&(this.buffer[i]=e);(t.light||t.heavy)&&(this.buffer.lowFlag=t.y<-.5)}take(t,e){const i=this.buffer[t];return i!==void 0&&e-i<=Pc?(delete this.buffer[t],!0):!1}peek(t,e){const i=this.buffer[t];return i!==void 0&&e-i<=Pc}pickTarget(t,e=!1){const i=t.filter(a=>a!==this&&a.alive&&a.team!==this.team);if(!i.length){this.target=this.target&&this.target!==this?this.target:null;return}if(e&&this.target){const a=i.indexOf(this.target);this.target=i[(a+1)%i.length];return}const n=i.filter(a=>a.state!==k.INTRO),r=n.length?n:i;if(this.target&&this.target.alive&&i.length>1){if(this.targetLock>0||!this.isCPU&&(this.state===k.ATTACK||this.comboTimer>0))return;const a=this.target.pos.distanceTo(this.pos);let o=null,l=1/0;for(const c of r){const h=c.pos.distanceTo(this.pos);h<l&&(l=h,o=c)}o&&o!==this.target&&l<a*.6&&(this.target=o);return}if(!this.target||!this.target.alive){let a=null,o=1/0;for(const l of r){const c=l.pos.distanceTo(this.pos);c<o&&(o=c,a=l)}this.target=a}}faceTarget(){this.target&&(_e.copy(this.target.pos).sub(this.pos),_e.y=0,_e.lengthSq()>1e-4&&this.facing.copy(_e.normalize()))}towardSign(t){if(!this.target||($i.copy(this.target.pos).sub(this.pos),$i.y=0,$i.lengthSq()<.04))return 0;$i.normalize();const e=$i.dot(t.camRight);return Math.abs(e)<.2?0:Math.sign(e)}update(t,e,i){const n=i.time;this.stateT+=t,this.invuln>0&&(this.invuln-=t),(!i.buffsActive||i.buffsActive())&&(this.buffs.attack>0&&(this.buffs.attack=Math.max(0,this.buffs.attack-t)),this.buffs.invincible>0&&(this.buffs.invincible=Math.max(0,this.buffs.invincible-t))),this.guard<ii.max&&this.state!==k.BLOCKSTUN&&this.state!==k.GUARD&&(this.guard=Math.min(ii.max,this.guard+ii.regen*t)),this.comboTimer>0&&(this.comboTimer-=t,this.comboTimer<=0&&(this.comboCount=0,this.comboDamage=0)),this.bufferPress(e,n),this.targetLock>0&&(this.targetLock-=t),e.target?(this.take("target",n),this.pickTarget(i.fighters,!0),this.targetLock=3):this.pickTarget(i.fighters,!1);const r=this.pos.y<=1e-4&&this.vel.y<=0;this.grounded=r;const a=Uv.set(0,0,0),o=this.towardSign(i);o!==0?a.copy($i).multiplyScalar(e.x*o):a.copy(i.camRight).multiplyScalar(e.x);const l=Math.min(1,Math.abs(e.x));this.holdingBack=o!==0&&e.x*o<-.3;const c=Math.abs(e.x)>=.5?Math.sign(e.x):0;c!==0&&c!==this._prevAx&&(this.lastTap.dir===c&&n-this.lastTap.t<.26?(this.buffer.dashX={t:n,dir:c},this.lastTap.t=-1):this.lastTap={t:n,dir:c}),this._prevAx=c;const h=this.peek("stepIn",n)&&this.buffer.stepIn>=this.lastHitTime,u=this.peek("stepOut",n)&&this.buffer.stepOut>=this.lastHitTime;if(((this.state===k.HITSTUN||this.state===k.LAUNCHED||this.state===k.BLOCKSTUN)&&n-this.lastHitTime<=Dv||this.state===k.KNOCKDOWN)&&(h||u)&&this.soul>=Ve.substitution&&this.lastHitBy&&this.lastHitBy.alive){const v=u&&!h;this.take("stepIn",n),this.take("stepOut",n),this.substitute(i,v)}switch(this.state){case k.INTRO:{this.vel.set(0,0,0),this.stateT>=1.4&&this.setState(k.IDLE);break}case k.IDLE:case k.WALK:case k.LAND:{if(this.state===k.LAND&&this.stateT>.1&&this.setState(k.IDLE),this.faceTarget(),this.tryActions(e,n,i,a))break;if(e.guard&&this.grounded){this.setState(k.GUARD),this.vel.x=0,this.vel.z=0;break}l>.1?(this.vel.x=a.x*this.char.speed,this.vel.z=a.z*this.char.speed,this.state!==k.LAND&&this.setState(k.WALK)):(this.vel.x=0,this.vel.z=0,this.state===k.WALK&&this.setState(k.IDLE));break}case k.GUARD:{if(this.faceTarget(),this.vel.x*=Math.exp(-14*t),this.vel.z*=Math.exp(-14*t),this.tryActions(e,n,i,a,!0))break;e.guard||this.setState(k.IDLE);break}case k.BLOCKSTUN:{this.vel.x*=Math.exp(-8*t),this.vel.z*=Math.exp(-8*t),this.stateT>=this.hitstunDur&&this.setState(e.guard?k.GUARD:k.IDLE);break}case k.DASH:{const v=this.dashShort?.15:.27,m=this.stateT/v,f=this.char.dashSpeed*(this.dashShort?.7:1)*(1-.5*m*m);if(this.vel.x=this.dashDir.x*f,this.vel.z=this.dashDir.z*f,this.stateT>.04&&Math.random()<.7&&ne.dashTrail(i.particles,this.pos,this.color),this.stateT>.08&&this.tryActions(e,n,i,a,!1,!0))break;this.stateT>=v&&(this.dashShort=!1,this.setState(k.IDLE));break}case k.SIDESTEP:{this.faceTarget(),Ki.crossVectors(this.facing,pr),Ki.dot(this.sidestepDir)<0&&Ki.negate();const m=10.5*(1-.6*(this.stateT/.32));if(this.vel.x=Ki.x*m,this.vel.z=Ki.z*m,this.stateT>.1&&this.tryActions(e,n,i,a,!1,!0))break;this.stateT>=.32&&this.setState(k.IDLE);break}case k.AIR:{const v=a.x*this.char.speed*.95,m=a.z*this.char.speed*.95,f=1-Math.exp(-3.2*t);l>.1&&(this.vel.x+=(v-this.vel.x)*f,this.vel.z+=(m-this.vel.z)*f),!e.jumpHeld&&!this.jumpCut&&this.stateT<.2&&this.vel.y>this.char.jumpSpeed*.7&&(this.vel.y=this.char.jumpSpeed*.7,this.jumpCut=!0),this.char.doubleJump&&this.airJumps<1&&this.take("jump",n)?(this.airJumps++,this.vel.y=this.char.jumpSpeed*.92,this.anim.play(this.clips.jump,{restart:!0,blend:.05}),ne.dust(i.particles,this.pos.clone().setY(this.pos.y+.1),6,10474495),i.audio.play("jump",{pitch:1.15})):this.take("light",n)&&this.airAttacks<2?(this.airAttacks++,this.startAttack(this.moves.airLight,i)):this.take("heavy",n)&&!this.airHeavyUsed&&(this.airHeavyUsed=!0,this.startAttack(this.moves.airHeavy,i));break}case k.ATTACK:{this.updateAttack(t,e,n,i,a);break}case k.THROWING:{this.updateThrow(t,i);break}case k.THROWN:{if(!this.thrower||this.thrower.state!==k.THROWING||this.thrower.throwVictim!==this){this.thrower=null,this.setState(k.IDLE);break}this.stateT<=.075&&(e.light||e.heavy||e.throw)&&this.thrower.breakThrow(i);break}case k.HITSTUN:{const v=Math.exp(-7*t);this.vel.x*=v,this.vel.z*=v,this.stateT>=this.hitstunDur&&this.setState(k.IDLE);break}case k.LAUNCHED:break;case k.KNOCKDOWN:{this.vel.x*=Math.exp(-6*t),this.vel.z*=Math.exp(-6*t),(e.jump||e.light||e.heavy)&&this.stateT>.2&&(this.wantsGetup=!0);const v=this.wantsGetup?.42:.75;this.stateT>=v&&(this.setState(k.GETUP),this.invuln=.5,this.wantsGetup=!1);break}case k.GETUP:{this.vel.x=0,this.vel.z=0,this.faceTarget(),this.stateT>=.42&&this.setState(k.IDLE);break}case k.KO:{this.vel.x*=Math.exp(-4*t),this.vel.z*=Math.exp(-4*t);break}case k.WIN:{this.vel.x=0,this.vel.z=0;break}}if(this.state!==k.THROWN){this.vel.y-=Iv*t,this.pos.addScaledVector(this.vel,t);const v=this.prevY>1e-4;if(this.pos.y<=0){this.pos.y=0;const m=this.vel.y;this.vel.y=0,(v||m<-.5)&&this.onLand(m,i)}this.pos.y>1e-4&&(this.state===k.IDLE||this.state===k.WALK||this.state===k.LAND)&&this.setState(k.AIR)}this.prevY=this.pos.y;const p=i.arenaRadius-this.radius,g=Math.hypot(this.pos.x,this.pos.z);if(g>p){const v=-this.pos.x/g,m=-this.pos.z/g;this.pos.x=-v*p,this.pos.z=-m*p;const f=this.vel.x*v+this.vel.z*m;if(f<0){const M=Math.hypot(this.vel.x,this.vel.z);(this.state===k.LAUNCHED||this.state===k.KO)&&M>7&&!this.wallBounced?(this.wallBounced=!0,this.vel.x-=1.55*f*v,this.vel.z-=1.55*f*m,this.vel.y=Math.max(this.vel.y,5.5),this.state!==k.KO&&this.takeChip(4,i,v,m),i.onWallBounce(this,new R(v,0,m))):(this.vel.x-=f*v,this.vel.z-=f*m)}}this.updateVisuals(t,e,a,i)}takeChip(t,e,i,n){!this.alive||this.buffs.invincible>0||(this.hp=Math.max(0,this.hp-t),this.flash=1,this.flashColor=null,e.onChip(this,t),!(this.hp>0)&&(this.alive=!1,this.setState(k.KO),this.vel.set(i*6,7,n*6),this.pos.y=Math.max(this.pos.y,.01),this.anim.play(this.clips.ko,{restart:!0,blend:.04,speed:1/.9}),e.onKO(this,this.lastHitBy,this.pos.clone().setY(this.pos.y+1),new R(i,0,n))))}onLand(t,e){if(this.state===k.AIR||this.state===k.ATTACK&&this.attack&&this.attack.def.kind==="air")this.state===k.ATTACK?(this.attack=null,this.setState(k.LAND)):this.setState(k.LAND),this.airJumps=0,this.airAttacks=0,this.airHeavyUsed=!1,ne.dust(e.particles,this.pos,t<-14?12:6),e.audio.play("land",{vol:Math.min(1,-t/20)});else if(this.state===k.LAUNCHED){if(t<-11&&!this._bounced){this._bounced=!0,this.vel.y=4.5,this.pos.y=.001,ne.dust(e.particles,this.pos,10),e.audio.play("land",{vol:.8,pitch:.7}),e.shake(.25);return}this._bounced=!1,this.setState(k.KNOCKDOWN),this.vel.x*=.3,this.vel.z*=.3,ne.dust(e.particles,this.pos,10),e.audio.play("land",{vol:.9,pitch:.6})}else this.state===k.KO&&(t<-6&&(ne.dust(e.particles,this.pos,10),e.audio.play("land",{vol:.9,pitch:.5})),this.vel.x*=.4,this.vel.z*=.4);this.airJumps=0,this.airAttacks=0,this.airHeavyUsed=!1}tryActions(t,e,i,n,r=!1,a=!1){if(!this.grounded)return!1;if(this.take("special",e)){if(this.soul>=this.moves.special.cost)return this.soul=0,this.startAttack(this.moves.special,i),i.onSpecial(this),!0;i.audio.play("deny")}if(this.take("throw",e))return this.startAttack(this.moves.throw,i),!0;if(this.take("heavy",e))return this.startAttack(this.buffer.lowFlag?this.moves.lowHeavy:this.moves.heavy,i),!0;if(this.take("light",e))return this.startAttack(this.buffer.lowFlag?this.moves.lowLight:this.moves.light1,i),!0;if(this.take("jump",e))return this.doJump(n,i),!0;if(a)return!1;if(this.buffer.dashX&&e-this.buffer.dashX.t<.1){const l=this.buffer.dashX.dir;delete this.buffer.dashX;const c=this.towardSign(i);c!==0?this.dashDir.copy($i).multiplyScalar(l*c):this.dashDir.copy(i.camRight).multiplyScalar(l),this.dashDir.normalize(),this.dashShort=!1,this.setState(k.DASH);const h=this.dashDir.dot(this.facing)>=0;return this.anim.play(h?this.clips.dash:this.clips.dashBack,{restart:!0,blend:.05}),ne.dust(i.particles,this.pos,6),i.audio.play("dash"),!0}let o=0;if(this.take("stepIn",e)?o=1:this.take("stepOut",e)&&(o=-1),o!==0){this.sidestepDir.copy(i.camForward).multiplyScalar(o),this.setState(k.SIDESTEP),this.invuln=.2;const c=Ki.crossVectors(this.facing,pr).dot(this.sidestepDir)>0;return this.anim.play(c?this.clips.sidestepL:this.clips.sidestepR,{restart:!0,blend:.05}),ne.dust(i.particles,this.pos,5,10474495),i.audio.play("dash",{pitch:1.3,vol:.7}),!0}return!1}doJump(t,e){this.vel.y=this.char.jumpSpeed,this.jumpCut=!1,t.lengthSq()>.01&&(this.vel.x=t.x*this.char.speed,this.vel.z=t.z*this.char.speed),this.pos.y=.002,this.setState(k.AIR),this.anim.play(this.clips.jump,{restart:!0,blend:.05}),ne.dust(e.particles,this.pos,5),e.audio.play("jump")}startAttack(t,e){this.setState(k.ATTACK),this.attack={def:t,t:0,hits:new Set,landed:!1,next:null,spawned:!1,sfxDone:!1},this.armor=!!t.armor,t.kind!=="special"&&(this.soul=Math.min(Ve.max,this.soul+Ve.gainSwing)),this.grounded&&(this.faceTarget(),t.kind!=="air"&&(this.vel.x*=.2,this.vel.z*=.2)),this.anim.play(this.clips[t.anim]||this.clips[t.id],{restart:!0,blend:.06}),this.trail.clear(),t.kind==="special"&&e.audio.play(t.sfx||"cast")}updateAttack(t,e,i,n,r){const a=this.attack,o=a.def;a.t+=t;const l=o.startup,c=l+o.active;if(!a.sfxDone&&a.t>=l-.02&&o.kind!=="special"&&(a.sfxDone=!0,n.audio.play(o.sfx||"swing",{pitch:o.kind==="light"?1+Math.random()*.2:.8})),o.kind==="air"){const h=1-Math.exp(-2*t);this.vel.x+=(r.x*this.char.speed*.8-this.vel.x)*h,this.vel.z+=(r.z*this.char.speed*.8-this.vel.z)*h,o.holdUntilLand&&a.t>=l&&(this.vel.y=Math.min(this.vel.y,-4))}else if(o.moveSpeed&&a.t>=l&&a.t<c)this.vel.x=this.facing.x*o.moveSpeed,this.vel.z=this.facing.z*o.moveSpeed;else{const h=Math.exp(-10*t);this.vel.x*=h,this.vel.z*=h}if(o.spawn&&!a.spawned&&a.t>=l&&(a.spawned=!0,n.spawnFromAttack(this,o)),o.kind==="light"&&(a.t>=l*.5&&a.t<o.total&&(o.chain&&this.peek("light",i)?a.next=o.chain:o.id!=="light4"&&this.peek("heavy",i)&&(a.next="heavy")),a.next&&a.t>=c+.02&&this.grounded)){const h=a.next;this.take(h==="heavy"?"heavy":"light",i),this.startAttack(this.moves[h],n);return}if(o.kind==="light"&&a.landed&&a.t>=c&&this.grounded&&this.take("throw",i)){this.feintStep(n);return}if(o.kind==="light"&&a.landed&&a.t>=c&&this.take("jump",i)&&this.grounded){this.doJump(r,n);return}a.t>=o.total&&(o.kind==="air"?(this.attack=null,this.setState(k.AIR)):this.setState(k.IDLE))}feintStep(t){this.setState(k.DASH),this.dashDir.copy(this.facing),this.dashShort=!0,this.anim.play(this.clips.dash,{restart:!0,blend:.05}),ne.dust(t.particles,this.pos,4),t.audio.play("dash",{pitch:1.25,vol:.6})}guardBreak(t,e,i,n){this.guard=ii.afterBreak,this.soul=Math.min(this.soul,ii.soulAfterBreak),this.setState(k.HITSTUN),this.hitstunDur=ii.breakStun,this.vel.set(n.x*3,0,n.z*3),this.flash=1,this.flashColor=new Ut(16765803),this.anim.play(this.clips.hit,{restart:!0,blend:.03,speed:1/ii.breakStun}),t.onGuardBreak(this,e,i,n.clone())}beginThrow(t,e){const i=this.moves.throw;this.setState(k.THROWING),this.throwVictim=t,this.throwT=0,this.throwDef=i,this.vel.set(0,0,0),_e.copy(t.pos).sub(this.pos),_e.y=0,_e.lengthSq()>1e-4&&this.facing.copy(_e.normalize()),t.setState(k.THROWN),t.thrower=this,t.vel.set(0,0,0),t.attack=null,t.facing.copy(this.facing).negate(),t.lastHitBy=this,t.lastHitTime=e.time,t.hitEventId++,this.anim.play(this.clips.throw,{restart:!0,blend:.05}),t.anim.play(t.clips.hit,{restart:!0,blend:.05,speed:1/Math.max(.3,i.releaseAt)}),e.onThrowStart(this,t)}updateThrow(t,e){const i=this.throwVictim,n=this.throwDef;if(this.throwT+=t,this.vel.set(0,0,0),!i||i.state!==k.THROWN||!i.alive){this.throwVictim=null,this.throwT>=n.throwTime&&this.setState(k.IDLE);return}const r=this.throwT;if(r<n.releaseAt){const a=Math.min(1,r/n.releaseAt),o=a<.4?0:(a-.4)/.6;i.pos.copy(this.pos).addScaledVector(this.facing,(.9+.25*a)*this.char.scale),i.pos.y=o*1.1*this.char.scale,i.vel.set(0,0,0)}else{i.thrower=null,i.setState(k.IDLE),i.pos.y=Math.max(i.pos.y,.02),i.invuln=0;const a=i.receiveHit({damage:this.scaleDamage(n.damage),kb:n.kb,reaction:"launch",hitstun:n.hitstun,hitstop:n.hitstop,unblockable:!0},this,i.pos.clone().setY(i.pos.y+.9),e);this.onHitLanded(i,a,e),this.throwVictim=null}this.throwT>=n.throwTime&&this.setState(k.IDLE)}breakThrow(t){const e=this.throwVictim;if(!e||e.state!==k.THROWN)return;e.thrower=null,this.throwVictim=null;const i=_e.copy(e.pos).sub(this.pos).setY(0);i.lengthSq()<1e-4&&i.copy(this.facing),i.normalize(),e.pos.y=0,e.setState(k.IDLE),e.vel.set(i.x*5,0,i.z*5),e.invuln=.15,this.setState(k.HITSTUN),this.hitstunDur=.3,this.vel.set(-i.x*4,0,-i.z*4),this.anim.play(this.clips.hit,{restart:!0,blend:.03,speed:1/.3}),e.anim.play(e.clips.land,{restart:!0,blend:.03}),t.onThrowBreak(this,e)}cancelThrow(){const t=this.throwVictim;t&&t.state===k.THROWN&&(t.thrower=null,t.setState(k.HITSTUN),t.hitstunDur=.25,t.anim.play(t.clips.hit,{restart:!0,blend:.05,speed:4})),this.throwVictim=null}substitute(t,e=!0){const i=this.lastHitBy,n=this.pos.clone();this.soul=0,_e.copy(i.facing).setY(0),_e.lengthSq()<1e-4&&_e.set(0,0,1),_e.normalize(),this.pos.set(i.pos.x-_e.x*1.9*i.char.scale,0,i.pos.z-_e.z*1.9*i.char.scale);const r=t.arenaRadius-this.radius-.1,a=Math.hypot(this.pos.x,this.pos.z);a>r&&(this.pos.x*=r/a,this.pos.z*=r/a),this.vel.set(0,0,0),this.juggle=0,this._bounced=!1,this.wallBounced=!1,this.wantsGetup=!1,this.target=i,this.faceTarget(),this.invuln=.45,this.prevY=0,i.comboTimer=0,i.comboCount=0,i.comboDamage=0,this.setState(k.IDLE),this.anim.play(this.clips.land,{restart:!0,blend:0}),e&&this.startAttack(this.moves.light1,t),t.onSubstitute(this,n,i,e)}hitSphere(){const t=this.attack;if(!t)return null;const e=t.def;if(!e.hit||t.t<e.startup||t.t>e.startup+e.active)return null;const i=this.char.scale,n=Ki.crossVectors(this.facing,pr),r=new R().copy(this.pos).addScaledVector(this.facing,e.hit.fwd*i).addScaledVector(pr,e.hit.up*i+(e.hit.up<0?.3:0)).addScaledVector(n,e.hit.side*i);return e.hit.up<0&&(r.y=Math.max(r.y,.25)),{c:r,r:e.hit.r*i}}hurtSpheres(){const t=this.char.scale;let e=.72,i=1.45,n=.62,r=.5;return(this.state===k.KNOCKDOWN||this.state===k.GETUP||this.state===k.KO)&&(e=.35,i=.4,n=.7,r=.4),[{c:new R(this.pos.x,this.pos.y+e*t,this.pos.z),r:n*t},{c:new R(this.pos.x,this.pos.y+i*t,this.pos.z),r:r*t}]}get vulnerable(){return this.alive&&this.invuln<=0&&this.buffs.invincible<=0&&this.state!==k.KO&&this.state!==k.INTRO&&this.state!==k.WIN&&this.state!==k.KNOCKDOWN&&this.state!==k.GETUP&&this.state!==k.THROWN}get throwable(){return!this.alive||this.pos.y>=.25||this.buffs.invincible>0?!1:this.state===k.SIDESTEP?!0:!(!this.vulnerable||this.state===k.LAUNCHED||this.state===k.THROWING||this.state===k.HITSTUN||this.state===k.BLOCKSTUN||this.state===k.ATTACK&&this.attack&&this.attack.t<this.attack.def.startup+this.attack.def.active)}receiveHit(t,e,i,n){const r=_e.copy(this.pos).sub(e?e.pos:this.pos);if(r.y=0,r.lengthSq()<1e-4&&r.copy(e?e.facing:this.facing),r.normalize(),this.buffs.invincible>0&&this.alive)return n.onBlock(this,e,i,r.clone()),{blocked:!0,immune:!0};this.state===k.THROWING&&this.cancelThrow();const a=!t.unblockable&&this.guarding&&this.grounded&&this.pos.y<.05,o=e?this.facing.dot(r)<.35:!0;if(a&&o)return this.setState(k.BLOCKSTUN),this.hitstunDur=Math.max(.2,t.hitstun*.7),this.guard-=t.damage*ii.blockCostMul,this.guard<=0?(this.lastHitBy=e,this.lastHitTime=n.time,this.hitEventId++,this.guardBreak(n,e,i,r),{blocked:!0,guardBreak:!0}):(this.vel.x=r.x*4.5,this.vel.z=r.z*4.5,this.soul=Math.min(Ve.max,this.soul+Ve.gainBlock),this.lastHitBy=e,this.lastHitTime=n.time,this.hitEventId++,this.anim.play(this.clips.block,{restart:!0,blend:.03,speed:1/this.hitstunDur}),n.onBlock(this,e,i,r.clone()),{blocked:!0});const l=this.pos.y>.05,c=(this.state===k.HITSTUN||this.state===k.LAUNCHED||this.state===k.BLOCKSTUN)&&n.time-this.lastHitTime<1;(!c||!this.comboOwner)&&(this.comboOwner=e);const h=c&&!!e&&!!this.comboOwner&&e!==this.comboOwner;this.lastHitBy=e,this.lastHitTime=n.time,this.hitEventId++;let u=t.damage;if(l&&this.state===k.LAUNCHED&&(u=Math.max(1,Math.round(u*Math.pow(.82,this.juggle)))),h&&(u=Math.max(1,Math.round(u*.6)),this.gangHits++),this.hp=Math.max(0,this.hp-u),this.soul=Math.min(Ve.max,this.soul+Ve.gainTaken),this.flash=1,this.flashColor=null,this.hp<=0)return this.alive=!1,this.setState(k.KO),this.vel.set(r.x*9,Math.max(7,t.kb.u*.7+5),r.z*9),this.pos.y=Math.max(this.pos.y,.01),this.anim.play(this.clips.ko,{restart:!0,blend:.04,speed:1/.9}),n.onKO(this,e,i,r.clone()),{blocked:!1,ko:!0,damage:u};if(this.armor&&this.state===k.ATTACK)return this.flashColor=new Ut(13215850),n.onHit(this,e,i,r.clone(),t,u,!0),{blocked:!1,damage:u,armored:!0};let p=t.reaction;switch(p==="hit"&&l&&(p="launch"),p==="spike"&&!l&&(p="hit"),h&&this.gangHits>=3&&p!=="spike"&&(p="knockdown"),p){case"hit":this.setState(k.HITSTUN),this.hitstunDur=h?Math.min(t.hitstun,.2):t.hitstun,this.vel.set(r.x*t.kb.f,0,r.z*t.kb.f),this.anim.play(this.clips.hit,{restart:!0,blend:.03,speed:1/Math.max(.15,t.hitstun)});break;case"launch":{const g=l?Math.max(4.5,t.kb.u*.75):t.kb.u;this.setState(k.LAUNCHED),this.juggle++,this._bounced=!1,this.vel.set(r.x*t.kb.f,Math.max(g,3.5),r.z*t.kb.f),this.pos.y=Math.max(this.pos.y,.01),this.anim.play(this.clips.launched,{restart:!0,blend:.05});break}case"spike":this.setState(k.LAUNCHED),this.juggle++,this._bounced=!1,this.vel.set(r.x*t.kb.f,t.kb.u,r.z*t.kb.f),this.anim.play(this.clips.spiked,{restart:!0,blend:.04});break;case"knockdown":default:this.setState(k.LAUNCHED),this._bounced=!1,this.vel.set(r.x*t.kb.f,Math.max(t.kb.u,4),r.z*t.kb.f),this.pos.y=Math.max(this.pos.y,.01),this.anim.play(this.clips.launched,{restart:!0,blend:.05});break}return n.onHit(this,e,i,r.clone(),t,u,!1),{blocked:!1,damage:u}}onHitLanded(t,e,i){if(this.attack&&(this.attack.landed=!0),e.blocked){this.soul=Math.min(Ve.max,this.soul+2);return}this.soul=Math.min(Ve.max,this.soul+Ve.gainHit),t.inHitState&&this.comboTimer>0?this.comboCount++:this.comboCount=1,this.comboDamage=(this.comboTimer>0?this.comboDamage:0)+(e.damage||0),this.comboTimer=1.3,this.attack&&this.attack.def.pogo&&this.pos.y>.02&&(this.vel.y=10.5,this.airAttacks=0,this.airHeavyUsed=!1,this.airJumps=0,this.attack=null,this.setState(k.AIR),this.anim.play(this.clips.jump,{restart:!0,blend:.05}),i.audio.play("jump",{pitch:1.3}))}setWin(){this.state!==k.KO&&(this.setState(k.WIN),this.vel.set(0,0,0),this.anim.play(this.clips.win,{restart:!0,blend:.2}))}updateVisuals(t,e,i,n){const r=this.clips,a=this.state,o=this.anim;switch(a){case k.IDLE:o.play(r.idle,{blend:.15});break;case k.WALK:{const u=this.facing.dot(i)>=-.2;o.play(r.walk,{blend:.12,speed:(u?1:-1)*Math.max(.6,Math.hypot(this.vel.x,this.vel.z)/6)});break}case k.LAND:o.play(r.land,{blend:.04});break;case k.AIR:{this.vel.y>1.5?o.play(r.jump,{blend:.08}):o.play(r.fall,{blend:.18});break}case k.GUARD:o.play(r.guard,{blend:.08});break;case k.KNOCKDOWN:o.play(r.knockdown,{blend:.06,speed:1/.75});break;case k.GETUP:o.play(r.getup,{blend:.05,speed:1/.42});break;case k.LAUNCHED:o.clip!==r.spiked&&o.play(r.launched,{blend:.06});break;case k.WIN:o.play(r.win,{blend:.2});break;case k.INTRO:o.play(r.intro,{blend:0});break}o.update(t);let c=Math.atan2(this.facing.x,this.facing.z)-this.visualYaw;for(;c>Math.PI;)c-=Math.PI*2;for(;c<-Math.PI;)c+=Math.PI*2;if(this.visualYaw+=c*(1-Math.exp(-18*t)),this.flash>0)this.flash=Math.max(0,this.flash-t*9),this.model.setFlash(this.flash,this.flashColor),this._buffGlow=!0;else if(this.alive&&(this.buffs.invincible>0||this.buffs.attack>0)){const u=this.buffs.invincible>0,d=u?this.buffDef.invincible:this.buffDef.attack,p=u?this.buffs.invincible:this.buffs.attack,g=p<1.5?Math.sin(p*22)>0?1:.25:1,v=(.35+.2*Math.sin(this.world.time*9))*g;this.model.setFlash(v,d?new Ut(d.color):null),this._buffGlow=!0}else this._buffGlow&&(this._buffGlow=!1,this.model.setFlash(0));if(this.syncTransform(),a===k.ATTACK&&this.attack&&this.attack.def.hit&&!this.attack.def.grab){const u=this.attack.def,d=this.attack.t;if(d>=u.startup-.03&&d<=u.startup+Math.min(u.active,.3)+.04){this.model.group.updateMatrixWorld(!0);const p=this.model.bladeBase.getWorldPosition(new R),g=this.model.bladeTip.getWorldPosition(new R);this.trail.push(p,g)}}this.trail.update(t),this.ring.visible=this.alive,this.ring.material.opacity=this.pos.y>.2?.35:.75;const h=this.alive&&this.target&&this.target.alive;this.arrowPivot.visible=!!h,h&&(_e.copy(this.target.pos).sub(this.pos),_e.y=0,_e.lengthSq()>1e-4&&(this.arrowPivot.rotation.y=Math.atan2(_e.x,_e.z)),this.arrowPivot.position.y=.04-this.pos.y,this.arrow.material.opacity=this.pos.y>.2?.4:.9),this.blob.position.set(this.pos.x,.02,this.pos.z),this.blob.material.opacity=Math.max(.08,.35-this.pos.y*.05),this.blob.scale.setScalar(Math.max(.5,1-this.pos.y*.06))}syncTransform(){this.group.position.copy(this.pos),this.model.group.rotation.y=this.visualYaw,this.ring.position.y=.03-this.pos.y}dispose(){this.scene.remove(this.group),this.scene.remove(this.blob),this.model.dispose(),this.trail.dispose(),this.ring.geometry.dispose(),this.ring.material.dispose(),this.arrow.geometry.dispose(),this.arrow.material.dispose(),this.blob.geometry.dispose(),this.blob.material.dispose()}}class Hh{constructor(t,e){this.f=t,this.d=e,this.plan={type:"wait",until:0},this.queue=[],this.jumpHoldUntil=0,this.threatKey=null,this.threatSince=0,this.threatHandled=!1,this.nextThink=0,this.guardUntil=0,this.dashSeq=null,this.lastHitEvent=t.hitEventId,this.rng=Math.random}press(t,e=0,i=0,n=!1){this.queue.push({at:i+e,btn:t,low:n})}think(t,e){const i=this.f,n=this.d,r=e.time,a=To();i.lastHitBy&&i.lastHitBy.alive&&i.lastHitBy!==i.target&&this.rng()<.03+n.aggression*.03&&(i.target=i.lastHitBy);const o=i.target;if(!o||!o.alive)return a;const l=o.pos.x-i.pos.x,c=o.pos.z-i.pos.z,h=Math.hypot(l,c),u=i.towardSign(e)||1,d=i.moves.light1.hit.fwd*i.char.scale+i.moves.light1.hit.r*i.char.scale+o.radius;i.hitEventId!==this.lastHitEvent&&(this.lastHitEvent=i.hitEventId,(i.state===k.HITSTUN||i.state===k.LAUNCHED)&&i.soul>=Ve.substitution&&this.rng()<n.sub&&this.press(this.rng()<.5?"stepIn":"stepOut",n.react*.5+this.rng()*.12,r));let p=null;if(o.state===k.ATTACK&&o.attack&&o.attack.def.hit){const m=o.attack.def,f=(i.pos.x-o.pos.x)*o.facing.x+(i.pos.z-o.pos.z)*o.facing.z>0,M=m.hit.fwd*o.char.scale+m.hit.r*o.char.scale+i.radius+.6;f&&h<M*1.25&&o.attack.t<m.startup+m.active&&(p={key:o.attack,kind:m.grab?"throw":m.kind})}if(!p)for(const m of e.entities){if(m.owner===i||m.dead||!m.vel||e.canHit&&m.owner&&!e.canHit(m.owner,i))continue;const f=m.pos.x-i.pos.x,M=m.pos.z-i.pos.z;if(Math.hypot(f,M)<6&&f*m.vel.x+M*m.vel.z<0){p={key:m,kind:"proj"};break}}if(p){if(this.threatKey!==p.key&&(this.threatKey=p.key,this.threatSince=r,this.threatHandled=!1),!this.threatHandled&&r-this.threatSince>=n.react*(.6+this.rng()*.8)){this.threatHandled=!0;const m=this.rng();(i.canAct||i.state===k.GUARD)&&(p.kind==="throw"?m<n.dodge+.3?this.press(this.rng()<.5?"stepIn":"stepOut",0,r):m<n.dodge+.5&&this.press("jump",0,r):p.kind==="proj"?m<n.dodge+.2?this.press(this.rng()<.5?"stepIn":"stepOut",0,r):m<n.dodge+n.guard+.2&&(this.guardUntil=r+.5,this.plan={type:"guard",until:this.guardUntil}):m<n.guard?(this.guardUntil=r+.35+this.rng()*.3,this.plan={type:"guard",until:this.guardUntil}):m<n.guard+n.dodge&&(this.rng()<.7?this.press(this.rng()<.5?"stepIn":"stepOut",0,r):this.startDash(-u,r)))}}else this.threatKey=null;(r>=this.nextThink||r>=this.plan.until)&&(this.nextThink=r+.12+this.rng()*.2,r>=this.plan.until&&this.choosePlan(r,h,d,o,u,e));let g=0;switch(this.plan.type){case"approach":g=u;break;case"retreat":g=-u;break;case"jumpIn":g=u*.9;break;case"space":{const m=d*1.15;h<m-.3?g=-u:h>m+.6&&(g=u);break}case"ring":{const m=d*2;h<m-.4?g=-u:h>m+.8&&(g=u);break}}if(this.dashSeq){const m=r-this.dashSeq.t0;m<.05?g=this.dashSeq.dir:m<.11?g=0:m<.5?g=this.dashSeq.dir:this.dashSeq=null}a.x=Math.max(-1,Math.min(1,g)),a.y=0,a.guard=r<this.guardUntil;for(let m=this.queue.length-1;m>=0;m--){const f=this.queue[m];r>=f.at&&(a[f.btn]=!0,f.low&&(a.y=-1),f.btn==="jump"&&(this.jumpHoldUntil=r+.28),this.queue.splice(m,1))}return a.jumpHeld=r<this.jumpHoldUntil,i.state===k.KNOCKDOWN&&i.stateT>.25&&this.rng()<n.aggression*.08&&(a.light=!0),i.state===k.THROWN&&(this.grabId!==i.hitEventId&&(this.grabId=i.hitEventId,this.breakThis=this.rng()<n.dodge+.1),this.breakThis&&i.stateT<=.07&&(a.light=!0)),a}startDash(t,e){this.dashSeq={dir:t,t0:e}}ringPlan(t){const e=this.rng;this.plan={type:"ring",until:t+.5+e()*.5},e()<.45&&this.press(e()<.5?"stepIn":"stepOut",.05,t),t-(this.lastPoke===void 0?-9:this.lastPoke)>2&&e()<.15&&(this.press("light",.1,t),this.lastPoke=t)}choosePlan(t,e,i,n,r,a){const o=this.f,l=this.d,c=this.rng,h=()=>a.requestAttack?a.requestAttack(o,t):!0,u=e<=i*1.05,d=n.state===k.KNOCKDOWN||n.state===k.GETUP,p=n.pos.y>1,g=n.guarding&&n.pos.y<.05&&!d,v=o.pos.y>.3;if(c()<l.mistake*.5){const y=c();if(y<.4){this.plan={type:"wait",until:t+.3+c()*.5};return}if(y<.7){this.plan={type:"retreat",until:t+.3};return}this.plan={type:"approach",until:t+.2},this.press("light",0,t);return}if(v){e<i*1.4&&c()<.6&&h()&&this.press("light",.05,t),this.plan={type:"approach",until:t+.25};return}if(d){if(c()<l.aggression*.35&&e<i*1.3&&h()){this.plan={type:"wait",until:t+.15},this.press("heavy",.05+c()*.2,t);return}this.plan={type:"space",until:t+.3+c()*.3};return}if(p&&e<3.5&&c()<.5+l.aggression*.3&&h()){this.plan={type:"wait",until:t+.4},this.press("heavy",0,t);return}const m=o.moves.special;if(o.soul>=m.cost&&c()<l.special*.6){const y=o.char.special.type;if((y==="projectile"&&e>4&&e<14||y==="wave"&&e>3&&e<10||y==="lunge"&&e>2.5&&e<9||y==="pillar"&&e>2&&e<6||y==="slam"&&e<4.2&&n.pos.y<1)&&h()){this.plan={type:"wait",until:t+.5},this.press("special",0,t);return}}if(!u){if(e>6&&c()<l.dash*.6){this.startDash(r,t),this.plan={type:"approach",until:t+.45};return}if(e>3&&e<8&&c()<l.jump*.7&&h()){this.plan={type:"jumpIn",until:t+.7},this.press("jump",0,t),this.press("light",.32+c()*.15,t);return}if(c()<.1){this.press(c()<.5?"stepIn":"stepOut",0,t),this.plan={type:"approach",until:t+.35};return}this.plan={type:"approach",until:t+.25+c()*.3};return}const f=Math.min(.95,l.attackRate*.42);if(c()<f){if(!h()){this.ringPlan(t);return}const y=c();if(g&&c()<l.throw){this.press("throw",0,t),this.plan={type:"wait",until:t+.8};return}if(y<.62){if(this.press("light",0,t,c()<.15),c()<l.combo){const x=.26/o.char.atkSpeed;this.press("light",x,t),c()<l.combo&&this.press("light",x*2,t),c()<l.combo&&this.press(c()<.5?"light":"heavy",x*3,t),c()<l.combo*.6&&(this.press("jump",x*4+.25,t),this.press("light",x*4+.5,t))}this.plan={type:"wait",until:t+.7}}else y<.85?(this.press("heavy",0,t,c()<.25),this.plan={type:"wait",until:t+.7}):(this.press("jump",0,t),this.press("heavy",.3,t),this.plan={type:"approach",until:t+.6});return}const M=c();M<.3?(this.press(c()<.5?"stepIn":"stepOut",0,t),this.plan={type:"wait",until:t+.35}):M<.5?this.plan={type:"retreat",until:t+.25}:M<.6+l.guard*.3?(this.guardUntil=t+.3,this.plan={type:"guard",until:t+.3}):this.plan={type:"wait",until:t+.15+c()*.2}}}const kv=new R(0,1,0);function Ov(s,t,e){for(const i of e)if(s.distanceTo(i.c)<=t+i.r)return i;return null}class Fv{constructor(t,e,i){this.owner=t,this.world=i,this.def=e;const n=e.proj;this.pos=t.pos.clone().addScaledVector(t.facing,.9*t.char.scale).addScaledVector(kv,1.05*t.char.scale),this.vel=t.facing.clone().multiplyScalar(n.speed),this.r=n.r,this.life=n.life,this.dead=!1,this.hits=new Set,this.t=0;const r=t.char.palette.accent;if(this.group=new Se,n.style==="crescent"){const a=new on(1,.11,10,28,Math.PI*.9),o=new he({color:16777215,transparent:!0,opacity:.95,blending:$e,depthWrite:!1}),l=new gt(a,o);l.rotation.z=-Math.PI*.45-Math.PI/2,this.group.add(l);const c=new gt(new on(1,.3,8,28,Math.PI*.9),new he({color:r,transparent:!0,opacity:.35,blending:$e,depthWrite:!1}));c.rotation.copy(l.rotation),this.group.add(c),this.group.lookAt(this.pos.clone().add(this.vel)),this.group.scale.setScalar(1.1*t.char.scale)}else{const a=new gt(new Xe(.22,16,12),new he({color:16777215})),o=new gt(new Xe(.5,16,12),new he({color:r,transparent:!0,opacity:.45,blending:$e,depthWrite:!1}));this.group.add(a,o),this.light=i.acquireLight(r,12,6),this.light&&this.light.position.copy(this.pos)}this.group.position.copy(this.pos),i.scene.add(this.group)}update(t){this.t+=t,this.life-=t,this.pos.addScaledVector(this.vel,t),this.group.position.copy(this.pos),this.light&&this.light.position.copy(this.pos),this.def.proj.style==="crescent"?this.group.scale.setScalar((1.1+this.t*1.2)*this.owner.char.scale):this.group.rotation.y+=t*8;const e=this.world;if(Math.random()<.8&&e.particles.emit({x:this.pos.x,y:this.pos.y,z:this.pos.z,vx:Math.random()-.5,vy:Math.random()-.5,vz:Math.random()-.5,life:.35,size:.5,color:this.owner.char.palette.accent,alpha:.6,drag:2}),Math.hypot(this.pos.x,this.pos.z)>e.arenaRadius-.3||this.life<=0){this.explode();return}for(const i of e.fighters){if(i===this.owner||!i.alive||this.hits.has(i.id)||!i.vulnerable||!e.canHit(this.owner,i))continue;if(Ov(this.pos,this.r,i.hurtSpheres())){this.hits.add(i.id);const r=this.def.proj,a=i.receiveHit({damage:this.owner.scaleDamage(this.def.damage),kb:r.kb,reaction:r.reaction,hitstun:r.hitstun,hitstop:this.def.hitstop,special:!0},this.owner,this.pos.clone(),e);this.owner.onHitLanded(i,a,e),this.explode();return}}}explode(){this.dead=!0,this.world.particles.burst(this.pos,16,{spread:.3,speed:5,life:.35,lifeVar:.4,size:.4,sizeVar:.5,color:this.owner.char.palette.accent,drag:3}),this.dispose()}dispose(){this.world.releaseLight(this.light),this.light=null,this.world.scene.remove(this.group),this.group.traverse(t=>{t.geometry&&t.geometry.dispose(),t.material&&t.material.dispose()})}}class zv{constructor(t,e,i){this.owner=t,this.world=i,this.def=e;const n=e.pillar;if(this.pos=t.pos.clone().addScaledVector(t.facing,n.dist*t.char.scale),this.pos.y=0,t.target&&t.target.alive){const o=t.target.pos,l=o.clone().sub(t.pos);l.y=0,l.length()<n.dist*t.char.scale+2.5&&l.dot(t.facing)>0&&this.pos.set(o.x,0,o.z)}this.t=0,this.dead=!1,this.hits=new Set,this.r=n.r,this.h=n.h,this.group=new Se,this.group.position.copy(this.pos);const r=new zi(n.r*.6,n.r*1.05,40);this.warn=new gt(r,new he({color:16734762,transparent:!0,opacity:0,side:Re,depthWrite:!1,blending:$e})),this.warn.rotation.x=-Math.PI/2,this.warn.position.y=.05,this.group.add(this.warn);const a=new je(n.r*.45,n.r*.9,n.h,20,1,!0);this.col=new gt(a,new he({color:16742970,transparent:!0,opacity:0,side:Re,depthWrite:!1,blending:$e})),this.col.position.y=n.h/2,this.group.add(this.col),this.light=i.acquireLight(16738858,0,9),this.light&&this.light.position.set(this.pos.x,1.5,this.pos.z),i.scene.add(this.group)}update(t){const e=this.def.pillar;this.t+=t;const i=this.world;if(this.t<e.delay){this.warn.material.opacity=.25+.5*(this.t/e.delay),this.warn.scale.setScalar(1.3-.3*(this.t/e.delay));return}const n=this.t-e.delay;this.fired||(this.fired=!0,i.audio.play("fire"),i.shake(.3));const r=n/e.active;if(r>=1.25){this.dead=!0,this.dispose();return}const a=r<1;if(this.col.material.opacity=a?.55:Math.max(0,.55*(1-(r-1)*4)),this.col.scale.set(1+.15*Math.sin(n*40),1,1+.15*Math.cos(n*37)),this.warn.material.opacity=a?.6:0,this.light&&(this.light.intensity=a?40:0),a&&ne.fire(i.particles,this.pos,6,e.r*.8),!!a)for(const o of i.fighters){if(o===this.owner||!o.alive||this.hits.has(o.id)||!o.vulnerable||!i.canHit(this.owner,o))continue;const l=o.pos.x-this.pos.x,c=o.pos.z-this.pos.z;if(Math.hypot(l,c)<=this.r+o.radius&&o.pos.y<this.h){this.hits.add(o.id);const h=o.pos.clone().setY(o.pos.y+1),u=o.receiveHit({damage:this.owner.scaleDamage(this.def.damage),kb:e.kb,reaction:e.reaction,hitstun:e.hitstun,hitstop:this.def.hitstop,unblockable:!1,special:!0},this.owner,h,i);this.owner.onHitLanded(o,u,i)}}}dispose(){this.world.releaseLight(this.light),this.light=null,this.world.scene.remove(this.group),this.group.traverse(t=>{t.geometry&&t.geometry.dispose(),t.material&&t.material.dispose()})}}class Bv{constructor(t,e,i){this.owner=t,this.world=i,this.def=e,this.pos=t.pos.clone(),this.pos.y=0,this.t=0,this.dead=!1,this.hits=new Set,this.group=new Se,this.group.position.copy(this.pos),this.ring=new gt(new zi(.75,1,48),new he({color:t.char.palette.accent,transparent:!0,opacity:.9,side:Re,depthWrite:!1,blending:$e})),this.ring.rotation.x=-Math.PI/2,this.ring.position.y=.08,this.group.add(this.ring),this.ring2=new gt(new zi(.4,1,48),new he({color:16777215,transparent:!0,opacity:.5,side:Re,depthWrite:!1,blending:$e})),this.ring2.rotation.x=-Math.PI/2,this.ring2.position.y=.06,this.group.add(this.ring2),i.scene.add(this.group),i.audio.play("slamHit"),i.shake(.7),ne.dust(i.particles,this.pos,30,12103056),this.radius=0}update(t){const e=this.def.wave;this.t+=t;const i=this.world,n=Math.min(1,this.t/e.grow);if(this.radius=e.maxR*n,this.ring.scale.setScalar(Math.max(.01,this.radius)),this.ring2.scale.setScalar(Math.max(.01,this.radius*.8)),this.ring.material.opacity=.9*(1-n),this.ring2.material.opacity=.5*(1-n),n<1&&Math.random()<.9){const r=Math.random()*Math.PI*2;i.particles.emit({x:this.pos.x+Math.cos(r)*this.radius,y:.1,z:this.pos.z+Math.sin(r)*this.radius,vx:Math.cos(r)*2,vy:3+Math.random()*3,vz:Math.sin(r)*2,life:.5,size:.7,color:13221024,alpha:.5,gravity:6,drag:2})}if(this.t>e.grow+.15){this.dead=!0,this.dispose();return}for(const r of i.fighters){if(r===this.owner||!r.alive||this.hits.has(r.id)||!r.vulnerable||!i.canHit(this.owner,r))continue;if(Math.hypot(r.pos.x-this.pos.x,r.pos.z-this.pos.z)<=this.radius+r.radius&&r.pos.y<1.2){this.hits.add(r.id);const o=r.pos.clone().setY(.6),l=r.receiveHit({damage:this.owner.scaleDamage(this.def.damage),kb:e.kb,reaction:e.reaction,hitstun:e.hitstun,hitstop:this.def.hitstop,special:!0},this.owner,o,i);this.owner.onHitLanded(r,l,i)}}}dispose(){this.world.scene.remove(this.group),this.group.traverse(t=>{t.geometry&&t.geometry.dispose(),t.material&&t.material.dispose()})}}const Yo={health:{id:"health",name:"Health Up",label:"HEALTH UP",color:8191882,heal:.35},attack:{id:"attack",name:"Attack Up",label:"ATTACK UP",color:16738874,duration:12,mul:1.5},invincible:{id:"invincible",name:"Invincibility",label:"INVINCIBLE",color:16765803,duration:5}},Gr=["health","attack","invincible"],nn={dropChance:.4,pity:4,spawnMin:18,spawnMax:28,maxAlive:2,lifetime:14,blink:3,pickRadius:1},Gh="hollow-arena.powerups.v1";function Hv(){return{health:!0,attack:!0,invincible:!0}}function Gv(){const s=Hv();try{const t=localStorage.getItem(Gh);if(!t)return s;const e=JSON.parse(t);if(!e||typeof e!="object")return s;for(const i of Gr)typeof e[i]=="boolean"&&(s[i]=e[i])}catch{}return s}function Ic(s){try{localStorage.setItem(Gh,JSON.stringify(s))}catch{}}const Fn={core:new Yn(.3,0),glow:new Yn(.52,0),ring:new zi(.55,.74,36)},Sr=new Map;function Vh(s){const t=Sr.get(s);if(t&&t.length)return t.pop();const e=Yo[s].color;return{core:new he({color:16777215,transparent:!0,opacity:1}),glow:new he({color:e,transparent:!0,opacity:.45,blending:$e,depthWrite:!1}),ring:new he({color:e,transparent:!0,opacity:.7,side:Re,depthWrite:!1})}}function Wh(s,t){t.core.opacity=1,t.glow.opacity=.45,t.ring.opacity=.7,Sr.has(s)||Sr.set(s,[]),Sr.get(s).push(t)}function Vv(s,t,e){const i=[];for(const n of Gr){const r=Vh(n),a=new Se;a.position.set(0,-200,0),a.add(new gt(Fn.core,r.core),new gt(Fn.glow,r.glow),new gt(Fn.ring,r.ring)),s.add(a),i.push({id:n,mats:r,g:a})}try{t.compile(s,e)}catch{}for(const{id:n,mats:r,g:a}of i)s.remove(a),Wh(n,r)}class Wv{constructor(t,e,i){this.type=t,this.def=Yo[t],this.world=i,this.pos=e.clone(),this.pos.y=0,this.t=0,this.life=nn.lifetime,this.dead=!1,this.isPickup=!0;const n=this.def.color;this.group=new Se,this.mats=Vh(t),this.core=new gt(Fn.core,this.mats.core),this.glow=new gt(Fn.glow,this.mats.glow),this.ring=new gt(Fn.ring,this.mats.ring),this.ring.rotation.x=-Math.PI/2,this.ring.position.y=.04,this.light=i.acquireLight?i.acquireLight(n,10,6):null,this.light&&this.light.position.set(this.pos.x,1,this.pos.z),this.group.add(this.core,this.glow,this.ring),this.group.position.copy(this.pos),i.scene.add(this.group),ne.soul(i.particles,this.pos.clone().setY(.8),10),i.particles.emit({x:this.pos.x,y:.9,z:this.pos.z,life:.25,size:3,color:n,alpha:.7,shrink:!1})}update(t){this.t+=t;const e=this.world;(!e.buffsActive||e.buffsActive())&&(this.life-=t);const i=.95+Math.sin(this.t*3)*.15;this.core.position.y=i,this.glow.position.y=i,this.core.rotation.y+=t*2.2,this.glow.rotation.y-=t*1.4,this.core.rotation.x=Math.sin(this.t)*.3,this.ring.scale.setScalar(1+Math.sin(this.t*3)*.08);const n=this.life<nn.blink?Math.sin(this.t*18)>0?1:.25:1;if(this.glow.material.opacity=.45*n,this.core.material.opacity=n,this.ring.material.opacity=.7*n,this.light&&(this.light.intensity=10*n),Math.random()<.35&&e.particles.emit({x:this.pos.x+(Math.random()-.5)*.7,y:.15,z:this.pos.z+(Math.random()-.5)*.7,vy:1.6,life:.7,size:.35,color:this.def.color,alpha:.6,drag:1}),this.life<=0){this.vanish();return}for(const r of e.fighters){if(!r.alive||!e.canCollect(r)||r.state===k.THROWN||r.state===k.KO||r.isCPU&&this.type==="invincible")continue;if(Math.hypot(r.pos.x-this.pos.x,r.pos.z-this.pos.z)<=nn.pickRadius+r.radius&&r.pos.y<1.6){this.collect(r);return}}}collect(t){this.dead=!0,t.applyPowerup(this.def,this.world),this.world.onPowerup(t,this.def,this.pos.clone()),this.dispose()}vanish(){this.dead=!0,ne.soul(this.world.particles,this.pos.clone().setY(.6),8),this.dispose()}dispose(){this.world.releaseLight&&this.world.releaseLight(this.light),this.light=null,this.world.scene.remove(this.group),Wh(this.type,this.mats)}}class Xv{constructor(t,e,{collectors:i="all"}={}){this.world=t,this.toggles=e||{},this.collectors=i,this.timer=this.nextDelay(),this.sinceDrop=0}get enabled(){return Gr.filter(t=>this.toggles[t])}nextDelay(){const t=nn;return t.spawnMin+Math.random()*(t.spawnMax-t.spawnMin)}alive(){let t=0;for(const e of this.world.entities)e.isPickup&&!e.dead&&t++;return t}pick({skipHealth:t=!1}={}){const e=this.enabled.filter(o=>!(t&&o==="health"));if(!e.length)return this.enabled.length?this.enabled[0]:null;const i=this.world.focus,n=i?1-i.hp/i.maxHp:.5,r=e.map(o=>o==="health"?.5+2*n:1);let a=Math.random()*r.reduce((o,l)=>o+l,0);for(let o=0;o<e.length;o++)if(a-=r[o],a<=0)return e[o];return e[e.length-1]}canCollect(t){return this.collectors==="all"||!t.isCPU}spawnAt(t,e=this.pick()){if(!e||this.alive()>=nn.maxAlive)return null;const i=t.clone();i.y=0;const n=this.world.arenaRadius-1.6,r=Math.hypot(i.x,i.z);r>n&&(i.x*=n/r,i.z*=n/r);const a=new Wv(e,i,this.world);return this.world.entities.push(a),a}onKO(t){if(!this.enabled.length)return null;if(this.sinceDrop++,Math.random()<nn.dropChance||this.sinceDrop>=nn.pity){const e=this.spawnAt(t.pos);return e&&(this.sinceDrop=0),e}return null}update(t){if(!this.enabled.length||(this.timer-=t,this.timer>0)||(this.timer=this.nextDelay(),this.alive()>0))return;const e=this.world.focus,i=Math.random()*Math.PI*2,n=2+Math.random()*(this.world.arenaRadius-5);this.spawnAt(new R(Math.cos(i)*n,0,Math.sin(i)*n),this.pick({skipHealth:!!e&&e.hp>=e.maxHp*.9}))}reset(){this.timer=this.nextDelay(),this.sinceDrop=0}}class Xh{constructor({scene:t,camera:e,input:i,audio:n,hud:r,particles:a,config:o,chars:l,difficulty:c,onEnd:h,survival:u=!1}){this.scene=t,this.input=i,this.audio=n,this.hud=r,this.particles=a,this.config=o,this.onEnd=h,this.survival=u,this.arenaRadius=zh,this.time=0,this.hitstop=0,this.timeScale=1,this.camRight=new R(1,0,0),this.camForward=new R(0,0,-1),this.cam=new Pv(e),this.entities=[],this.fighters=[],this.brains=new Map,this.winsNeeded=o.winsNeeded,this.roundTime=o.roundTime,this.round=0,this.phase="idle",this.phaseT=0,this.timer=this.roundTime,this.roundWinner=null,this.matchWinner=null,this.koSlow=0,this.cineSlow=0,this.paused=!1,this.finished=!1,this.humanSlots=[],o.slots.forEach((d,p)=>{if(d.type==="off")return;const g=new Ao({char:l[p],slot:p,isCPU:d.type==="cpu",scene:t,world:this,team:p});this.fighters.push(g),d.type==="cpu"?this.brains.set(g,new Hh(g,c)):this.humanSlots.push(p)}),this.focus=this.fighters.find(d=>!d.isCPU)||this.fighters[0],this.lightPool=Array.from({length:4},()=>{const d=new ln(16777215,0,6,2);return d.position.set(0,-50,0),t.add(d),d}),this.powerups=new Xv(this,o.powerups,{collectors:u?"human":"all"}),r.setup(this.fighters,u?0:this.winsNeeded,{survival:u}),r.show(),r.update(this.timer,0)}warm(t,e){Vv(this.scene,t,e)}acquireLight(t,e,i=6){const n=this.lightPool.find(r=>!r.userData.busy);return n?(n.userData.busy=!0,n.color.set(t),n.intensity=e,n.distance=i,n):null}releaseLight(t){t&&(t.userData.busy=!1,t.intensity=0,t.position.set(0,-50,0))}canHit(t,e){return t!==e&&t.team!==e.team}canCollect(t){return this.powerups.canCollect(t)}inputActive(){return this.phase==="fight"}buffsActive(){return this.phase==="fight"}cinematicFor(){return!0}requestAttack(){return!0}startRound(){this.round++;const t=this.fighters.length,e=t===2?4.2:5.2;this.fighters.forEach((n,r)=>{let a,o;if(t===2)a=new R(r===0?-e:e,0,0),o=new R(r===0?1:-1,0,0);else{const l=Math.PI+r/t*Math.PI*2;a=new R(Math.cos(l)*e,0,Math.sin(l)*e*.75),o=a.clone().negate().setY(0).normalize()}n.target=null,n.reset(a,o)});for(const n of this.fighters)n.pickTarget(this.fighters);for(const n of this.entities)n.dispose();this.entities=[],this.timer=this.roundTime,this.timeScale=1,this.hitstop=0,this.powerups.reset(),this.cam.normal.set(0,0,1),this.cam.snap(),this.cam.update(0,this.fighters,this.focus),this.camRight.copy(this.cam.right),this.camForward.copy(this.cam.forward),this.setPhase("intro");const i=this.fighters.some(n=>n.roundWins===this.winsNeeded-1)&&this.fighters.filter(n=>n.roundWins===this.winsNeeded-1).length>=2;this.hud.announce(i?"FINAL ROUND":`ROUND ${this.round}`,{hold:1.3}),this.audio.play("announce")}setPhase(t){this.phase=t,this.phaseT=0}shake(t){this.cam.shake(t)}onHit(t,e,i,n,r,a,o){const l=r.hitstop>=.08;this.hitstop=Math.max(this.hitstop,o?.03:r.hitstop),ne.hitSpark(this.particles,i,n,e?e.char.palette.accent:16777215,l),this.shake(l?.45:.18),this.audio.play(l?"hitHeavy":"hit",{pitch:.9+Math.random()*.2}),r.special&&!o&&this.phase==="fight"&&this.cinematicFor(e)&&(this.cineSlow=.6,this.cam.punch(.62,.7)),e&&e.soul>=e.moves.special.cost&&e.soul-10<e.moves.special.cost&&this.audio.play("soul",{vol:.6})}onBlock(t,e,i,n){this.hitstop=Math.max(this.hitstop,.03),ne.blockSpark(this.particles,i,n),this.audio.play("block"),this.shake(.1)}onKO(t,e,i,n){this.hitstop=Math.max(this.hitstop,.22),ne.hitSpark(this.particles,i,n,16777215,!0),ne.ko(this.particles,i),this.audio.play("ko"),this.shake(.9),this.koSlow=.9,this.hud.announce("K.O.",{ko:!0,hold:1.2}),!this.survival&&this.fighters.filter(r=>r.alive).length>1&&this.powerups.onKO(t)}onChip(){}onWallBounce(t,e){this.hitstop=Math.max(this.hitstop,.06);const i=t.pos.clone().setY(t.pos.y+1);ne.wallHit(this.particles,i,e),this.audio.play("wall"),this.shake(.45)}onSpecial(t){ne.soul(this.particles,t.pos.clone().setY(t.pos.y+1),12),this.hud.sub(`${t.name} — ${t.moves.special.name}`,1.1)}onGuardBreak(t,e,i,n){this.hitstop=Math.max(this.hitstop,.1),ne.hitSpark(this.particles,i,n,16765803,!0),this.audio.play("wall"),this.audio.play("block",{pitch:.6}),this.shake(.4),this.hud.sub(`${t.name} — Guard Break`,1)}onThrowBreak(t,e){ne.blockSpark(this.particles,e.pos.clone().setY(1),e.facing.clone()),this.audio.play("block",{pitch:.8}),this.hud.sub(`${e.name} — Throw Break`,.9)}onSubstitute(t,e,i,n){ne.soul(this.particles,e.clone().setY(e.y+.9),18),this.particles.emit({x:e.x,y:e.y+.9,z:e.z,life:.3,size:5,color:16777215,alpha:.7,shrink:!1}),ne.soul(this.particles,t.pos.clone().setY(.9),10),this.audio.play("cast",{pitch:.75}),this.hitstop=Math.max(this.hitstop,.05),this.shake(.2),this.hud.sub(`${t.name} — ${n?"Offensive ":""}Substitution`,1)}onThrowStart(t,e){this.audio.play("swingHeavy",{pitch:.7}),ne.dust(this.particles,e.pos,6)}onPowerup(t,e,i){this.particles.burst(i.clone().setY(.9),30,{spread:.4,speed:6,speedVar:.5,life:.6,lifeVar:.4,size:.5,sizeVar:.5,color:e.color,alpha:.9,gravity:-2,drag:2}),this.particles.emit({x:i.x,y:1,z:i.z,life:.3,size:6,color:e.color,alpha:.6,shrink:!1}),this.audio.play("soul",{vol:1.2}),this.audio.play("menuConfirm",{vol:.6}),this.hud.sub(`${t.name} — ${e.label}`,1.1),this.hud.flashHealth(t,e.id==="health")}spawnFromAttack(t,e){let i=null;e.spawn==="projectile"?i=new Fv(t,e,this):e.spawn==="pillar"?i=new zv(t,e,this):e.spawn==="shockwave"&&(i=new Bv(t,e,this)),i&&this.entities.push(i)}cmdFor(t){if(t.isCPU)return this.brains.get(t).think(this.lastDt,this);const e=this.input.players[t.slot],i=To();return i.x=e.x,i.y=e.y,i.jump=e.pressed.jump,i.jumpHeld=e.held.jump,i.light=e.pressed.light,i.heavy=e.pressed.heavy,i.special=e.pressed.special,i.throw=e.pressed.throw,i.guard=e.held.guard,i.target=e.pressed.target,i.stepIn=e.pressed.stepIn,i.stepOut=e.pressed.stepOut,i}pausePressed(){for(const t of this.humanSlots)if(this.input.players[t].pressed.pause)return!0;return!1}update(t){let e=Math.min(t,.03333333333333333);this.koSlow>0?(this.koSlow-=t,this.timeScale=.28):this.cineSlow>0?(this.cineSlow-=t,this.timeScale=.3):this.timeScale=1,e*=this.timeScale,this.lastDt=e,this.phaseT+=t;const i=this.inputActive();if(this.hitstop>0){if(this.hitstop-=t,i)for(const r of this.fighters)r.bufferPress(this.cmdFor(r),this.time);this.particles.update(e*.25);for(const r of this.fighters)r.trail.update(0);this.cam.update(t,this.fighters,this.focus),this.hud.update(this.timer,t);return}this.time+=e;const n=To();for(const r of this.fighters){const a=i?this.cmdFor(r):n;r.update(e,a,this)}this.separate(),this.resolveMelee();for(let r=this.entities.length-1;r>=0;r--){const a=this.entities[r];a.update(e),a.dead&&this.entities.splice(r,1)}this.phase==="fight"&&this.powerups.update(e),this.particles.update(e),this.cam.update(t,this.fighters,this.focus),this.camRight.copy(this.cam.right),this.camForward.copy(this.cam.forward),this.updatePhase(e,t),this.hud.update(this.timer,t)}updatePhase(t){switch(this.phase){case"intro":this.phaseT>=1.55&&(this.setPhase("fight"),this.hud.announce("FIGHT",{hold:.8}),this.audio.play("fight"));break;case"fight":{this.timer!==1/0&&(this.timer=Math.max(0,this.timer-t));const e=this.fighters.filter(i=>i.alive);if(e.length<=1)this.roundWinner=e[0]||null,this.endRound();else if(this.timer<=0){let i=null,n=-1,r=!1;for(const a of e){const o=a.hp/a.maxHp;o>n+1e-6?(i=a,n=o,r=!1):Math.abs(o-n)<1e-6&&(r=!0)}this.roundWinner=r?null:i,this.hud.announce("TIME",{hold:1.2}),this.audio.play("announce"),this.endRound(!0)}break}case"roundEnd":this.phaseT>=2.6&&(this.matchWinner?(this.setPhase("matchEnd"),this.hud.announce("WINNER",{sub:this.matchWinner.name,hold:2.2}),this.audio.play("win")):this.startRound());break;case"matchEnd":this.phaseT>=2.4&&!this.finished&&(this.finished=!0,this.setPhase("done"),this.onEnd&&this.onEnd({winner:this.matchWinner,fighters:this.fighters}));break}}endRound(t=!1){this.setPhase("roundEnd");const e=this.roundWinner;e?(e.roundWins++,e.setWin(),(e.roundWins>=this.winsNeeded||this.round>=9)&&(this.matchWinner=e),t?this.hud.announce(e.name,{sub:"wins on vitality",hold:1.6}):(clearTimeout(this._roundTimer),this._roundTimer=setTimeout(()=>{this.phase==="roundEnd"&&!this.disposed&&this.hud.announce(e.name,{sub:"wins the round",hold:1.4})},900))):(this.hud.announce("DRAW",{hold:1.5}),this.round>=9&&(this.matchWinner=this.fighters.slice().sort((i,n)=>n.roundWins-i.roundWins)[0]));for(const i of this.fighters)i!==e&&i.alive&&i.state!==k.KO&&i.setState(k.IDLE)}separate(){const t=this.fighters;for(let e=0;e<t.length;e++)for(let i=e+1;i<t.length;i++){const n=t[e],r=t[i];if(!n.group.visible||!r.group.visible||!n.alive||!r.alive||n.state===k.THROWING||n.state===k.THROWN||r.state===k.THROWING||r.state===k.THROWN)continue;const a=r.pos.x-n.pos.x,o=r.pos.z-n.pos.z,l=Math.hypot(a,o),c=n.radius+r.radius;if(l>=c||Math.abs(n.pos.y-r.pos.y)>1.3)continue;let h,u;l<1e-4?(h=Math.cos(n.id+r.id),u=Math.sin(n.id+r.id)):(h=a/l,u=o/l);const d=c-l,p=n.state===k.LAUNCHED||n.state===k.KO,g=r.state===k.LAUNCHED||r.state===k.KO;let v=.5,m=.5;if(p&&!g)v=0,m=1;else if(g&&!p)v=1,m=0;else{const f=n.char.weight+r.char.weight;v=r.char.weight/f,m=n.char.weight/f}n.pos.x-=h*d*v,n.pos.z-=u*d*v,r.pos.x+=h*d*m,r.pos.z+=u*d*m}}resolveMelee(){for(const t of this.fighters){if(t.state!==k.ATTACK||!t.attack)continue;const e=t.hitSphere();if(!e)continue;const i=t.attack,n=i.def;for(const r of this.fighters){if(t.attack!==i)break;if(!(r===t||!r.alive||i.hits.has(r.id)||!this.canHit(t,r))&&!(n.grab?!r.throwable:!r.vulnerable)){for(const a of r.hurtSpheres())if(e.c.distanceTo(a.c)<=e.r+a.r){if(i.hits.add(r.id),n.grab){t.beginThrow(r,this);break}const o=e.c.clone().lerp(a.c,.5),l=r.receiveHit({damage:t.scaleDamage(n.damage),kb:n.kb,reaction:n.reaction,hitstun:n.hitstun,hitstop:n.hitstop,unblockable:!!n.unblockable,special:n.kind==="special"},t,o,this);t.onHitLanded(r,l,this);break}}}}}dispose(){this.disposed=!0,clearTimeout(this._roundTimer);for(const t of this.fighters)t.dispose();for(const t of this.entities)t.dispose();this.entities=[];for(const t of this.lightPool)this.scene.remove(t),t.dispose&&t.dispose();this.hud.hide()}}const ve={maxConcurrent:3,reinforceDelay:1.2,hpBase:.9,hpStep:.05,hpCap:1.8,healOnClear:.25,healFloor:15,breather:2.6,removeAfter:1.3,removeAfterLate:.8,lateWave:12,vanishTime:.5,tokenHold:1,tokenMax:2.5,spawnDist:7,spawnGap:2.5,tierWaves:[1,4,8],koSlow:.35},qh="hollow-arena.survival.best.v1",qv=new Ut(16777215);function Yv(s){return Math.min(6,1+Math.floor(s/2))}function Kv(s){return Math.min(ve.maxConcurrent,s<=2?1:s<=5?2:3)}function $v(s){return Math.min(ve.hpCap,ve.hpBase+ve.hpStep*(s-1))}function Yh(s){return s>=ve.tierWaves[2]?2:s>=ve.tierWaves[1]?1:0}function Dc(s,t=1){const[e,i,n,r]=Rs;let a,o,l;s<=4?(a=e,o=i,l=(s-1)/3):s<=9?(a=i,o=n,l=(s-5)/4):(a=n,o=r,l=Math.min(.5,(s-9)/22));const c=Rs[Yh(s)],h={id:c.id,name:c.name};for(const d of Object.keys(e))typeof e[d]=="number"&&(h[d]=a[d]+(o[d]-a[d])*l);const u=1-.12*(Math.max(1,t)-1);return h.aggression*=u,h.attackRate*=u,h}function Ko(){try{const s=JSON.parse(localStorage.getItem(qh)||"null");if(s&&Number.isFinite(s.wave))return{wave:s.wave|0,score:s.score|0,kills:s.kills|0}}catch{}return{wave:0,score:0,kills:0}}function jv(s){try{localStorage.setItem(qh,JSON.stringify(s))}catch{}}class Zv extends Xh{constructor(t){super({...t,survival:!0}),this.wave=0,this.reserve=0,this.kills=0,this.score=0,this.elapsed=0,this.tier=-1,this.pool=new Map,this.lanes=[null,null,null],this.spawnQueue=[],this.player=this.fighters[0],this.player.team=0,this.best=Ko(),this.roundTime=1/0,this.timer=1/0,this.winsNeeded=0,this.gameOverShown=!1;for(const e of Ie){const i=new Ao({char:e,slot:1,isCPU:!0,scene:this.scene,world:this,team:1});i.group.visible=!1,i.blob.visible=!1,this.pool.set(e.id,[i])}this.tokens=new Map,this.cooldown=new Map,this.tookDamage=!1,this.cam.keepFocus=!0}requestAttack(t,e){for(const[r,a]of this.tokens)(a.exp<=e||!r.alive)&&this.tokens.delete(r);const i=this.cooldown.get(t);if(i!==void 0){if(e<i)return!1;this.cooldown.delete(t)}const n=this.tokens.get(t);return n?e-n.since>ve.tokenMax?(this.tokens.delete(t),this.cooldown.set(t,e+ve.tokenHold),!1):(n.exp=e+ve.tokenHold,!0):this.tokens.size>=(this.tier>=2?2:1)?!1:(this.tokens.set(t,{exp:e+ve.tokenHold,since:e}),!0)}buffsActive(){return this.phase==="fight"&&this.fighters.some(t=>t!==this.player&&t.alive&&t.state!==k.INTRO)}cinematicFor(t){return t===this.player}onHit(t,e,i,n,r,a,o){t===this.player&&a>0&&(this.tookDamage=!0),super.onHit(t,e,i,n,r,a,o)}onChip(t){t===this.player&&(this.tookDamage=!0)}abandon(){this.wave>0&&!this.finished&&this.results()}warm(t,e){super.warm(t,e);const i=[...this.pool.values()].flat();for(const n of i)n.group.visible=!0,n.group.position.set(0,-300,0),n.group.traverse(r=>{r.frustumCulled=!1});try{t.render(this.scene,e)}catch{}for(const n of i)n.group.visible=!1,n.group.position.set(0,0,0),n.group.traverse(r=>{r.frustumCulled=!0})}startRound(){this.round=1;const t=this.player;t.target=null,t.reset(new R(-2.5,0,0),new R(1,0,0));for(const e of this.entities)e.dispose();this.entities=[],this.timeScale=1,this.hitstop=0,this.cam.normal.set(0,0,1),this.cam.snap(),this.cam.update(0,this.fighters,this.focus),this.camRight.copy(this.cam.right),this.camForward.copy(this.cam.forward),this.powerups.reset(),this.setPhase("intro"),this.hud.announce("SURVIVAL",{sub:"the vessels do not stop coming",hold:1.4}),this.audio.play("announce"),this.refreshHud()}inputActive(){return this.phase==="fight"||this.phase==="clear"}enemies(){return this.fighters.filter(t=>t!==this.player)}aliveEnemies(){let t=0;for(const e of this.fighters)e!==this.player&&e.alive&&t++;return t}beginWave(t){this.wave=t,this.round=t,this.reserve=Yv(t);const e=Yh(t),i=e!==this.tier;this.tier=e,this.hud.announce(`WAVE ${t}`,{sub:i?`${Rs[e].name} vessels`:"",hold:1.3}),this.audio.play("announce"),this.tookDamage=!1,this.setPhase("fight");const n=Math.min(Kv(t),this.reserve);this.spawnQueue.length=0;for(let r=0;r<n;r++)this.spawnQueue.push(.2+r*.4)}pickChar(){const t=new Set;for(const i of this.fighters)i!==this.player&&i.alive&&t.add(i.char.id);let e=Ie.filter(i=>!t.has(i.id));return e.length||(e=Ie),e[Math.floor(Math.random()*e.length)]}spawnPoint(){const t=this.player.pos,e=this.arenaRadius-1.5;let i=null,n=-1;for(let r=0;r<10;r++){const a=Math.random()*Math.PI*2,o=new R(t.x+Math.cos(a)*ve.spawnDist,0,t.z+Math.sin(a)*ve.spawnDist),l=Math.hypot(o.x,o.z);l>e&&(o.x*=e/l,o.z*=e/l);let c=1/0;for(const h of this.fighters)h.group.visible&&(c=Math.min(c,Math.hypot(h.pos.x-o.x,h.pos.z-o.z)));if(c>=ve.spawnGap)return o;c>n&&(n=c,i=o)}return i}acquire(t,e){const i=this.pool.get(t.id);let n=i&&i.length?i.pop():null;return n||(n=new Ao({char:t,slot:e,isCPU:!0,scene:this.scene,world:this,team:1})),n.setSlot(e),n.team=1,n}spawnEnemy(){if(this.reserve<=0)return!0;const t=this.lanes.indexOf(null);if(t<0)return!1;const e=this.pickChar();this.reserve--;const i=this.acquire(e,t+1),n=this.spawnPoint(),r=this.player.pos.clone().sub(n).setY(0);return r.lengthSq()<1e-4&&r.set(1,0,0),r.normalize(),i.setMaxHp(Math.round(e.hp*$v(this.wave))),i.soul=0,i.roundWins=0,i.target=null,i.reset(n,r),this.lanes[t]=i,this.fighters.push(i),this.brains.set(i,new Hh(i,Dc(this.wave,this.aliveEnemies()))),i.pickTarget(this.fighters),this.player.pickTarget(this.fighters),ne.soul(this.particles,n.clone().setY(.9),16),this.particles.emit({x:n.x,y:1,z:n.z,life:.3,size:4,color:16777215,alpha:.6,shrink:!1}),this.audio.play("cast",{pitch:.6,vol:.7}),this.refreshDifficulty(),this.refreshHud(),!0}refreshDifficulty(){const t=this.aliveEnemies();for(const[e,i]of this.brains)e.alive&&(i.d=Dc(this.wave,t))}refreshHud(){this.hud.setup(this.fighters,0,{survival:!0})}release(t){const e=this.fighters.indexOf(t);e>=0&&this.fighters.splice(e,1);const i=this.lanes.indexOf(t);i>=0&&(this.lanes[i]=null),this.brains.delete(t),this.tokens.delete(t),this.cooldown.delete(t),t.group.visible=!1,t.blob.visible=!1,t.trail.clear(),t.group.scale.setScalar(1),t.model.setFlash(0),t.deadT=0;for(const n of this.fighters)n.target===t&&(n.target=null),n.lastHitBy===t&&(n.lastHitBy=null),n.comboOwner===t&&(n.comboOwner=null);this.pool.has(t.char.id)||this.pool.set(t.char.id,[]),this.pool.get(t.char.id).push(t),this.player.pickTarget(this.fighters),this.refreshDifficulty(),this.refreshHud()}cleanupDead(t){for(const e of this.enemies()){if(e.alive)continue;e.deadT=(e.deadT||0)+t;const i=this.wave>=ve.lateWave?ve.removeAfterLate:ve.removeAfter,n=(e.deadT-i)/ve.vanishTime;if(!(n<=0)){if(n>=1){ne.soul(this.particles,e.pos.clone().setY(.6),12),this.release(e);continue}e.group.scale.setScalar(Math.max(.01,1-n)),e.model.setFlash(Math.min(1,n*1.5),qv),e.blob.material.opacity=.3*(1-n)}}}tickSpawns(t){for(let e=this.spawnQueue.length-1;e>=0;e--)this.spawnQueue[e]-=t,this.spawnQueue[e]<=0&&(this.spawnEnemy()?this.spawnQueue.splice(e,1):this.spawnQueue[e]=.05)}onKO(t,e,i,n){if(t===this.player){super.onKO(t,e,i,n);return}this.hitstop=Math.max(this.hitstop,.14),ne.hitSpark(this.particles,i,n,16777215,!0),ne.ko(this.particles,i),this.audio.play("ko",{vol:.8}),this.shake(.6),this.koSlow=ve.koSlow,this.kills++;const r=e===this.player&&e.comboTimer>0?e.comboCount+1:1,a=Math.round(100*[1,1.5,2][this.tier]*(1+.15*(r-1))/10)*10;this.score+=a,this.hud.sub(`${t.name} falls   +${a}`,.9),this.powerups.onKO(t),this.reserve>0&&this.spawnQueue.push(ve.reinforceDelay),this.refreshDifficulty()}clearWave(){const t=!this.tookDamage,e=100*this.wave+(t?Math.round(150*[1,1.5,2][this.tier]*this.wave):0);this.score+=e;const i=this.player;i.hp=Math.min(i.maxHp,i.hp+Math.max(ve.healFloor,Math.round(i.maxHp*ve.healOnClear))),i.guard=ii.max,i.flash=1,i.flashColor=new Ut(8191882),this.tokens.clear(),this.cooldown.clear(),this.hud.announce(`WAVE ${this.wave}`,{sub:`cleared${t?" flawless":""}   ·   +${e}   ·   vitality restored`,hold:1.7}),this.audio.play("win"),this.setPhase("clear")}updatePhase(t){switch(this.phase){case"intro":this.phaseT>=1.6&&this.beginWave(1);break;case"fight":if(this.elapsed+=t,!this.player.alive){this.setPhase("dying");break}this.tickSpawns(t),this.cleanupDead(t),this.reserve===0&&!this.spawnQueue.length&&this.aliveEnemies()===0&&this.clearWave();break;case"clear":if(this.elapsed+=t,this.cleanupDead(t),!this.player.alive){this.setPhase("dying");break}this.phaseT>=ve.breather&&this.beginWave(this.wave+1);break;case"dying":if(this.cleanupDead(t),this.phaseT>=1.5&&!this.gameOverShown){this.gameOverShown=!0,this.hud.announce("GAME OVER",{sub:`wave ${this.wave}`,hold:2.4}),this.audio.play("announce");for(const e of this.fighters)e!==this.player&&e.alive&&e.setWin()}this.phaseT>=3.9&&!this.finished&&(this.finished=!0,this.setPhase("done"),this.onEnd&&this.onEnd(this.results()));break}this.hud.setWave(this)}results(){const t=this.best,e=this.wave>t.wave||this.wave===t.wave&&this.score>t.score;return e&&(this.best={wave:this.wave,score:this.score,kills:this.kills},jv(this.best)),{survival:!0,wave:this.wave,kills:this.kills,score:this.score,time:this.elapsed,best:this.best,newBest:e,winner:null,fighters:this.fighters}}dispose(){super.dispose();for(const t of this.pool.values())for(const e of t)e.dispose();this.pool.clear()}}class Un{constructor(t,{wrap:e=!0}={}){for(this.items=t,this.index=0,this.wrap=e,this.el=null,this.rows=[];this.items[this.index]&&this.items[this.index].disabled;)this.index++}mount(t){return this.el=document.createElement("div"),this.el.className="menu-list",this.rows=this.items.map((e,i)=>{const n=document.createElement("div");return n.className="menu-item"+(e.disabled?" disabled":""),n.innerHTML=`<span class="lbl">${e.label}</span>`+(e.value?'<span class="val"></span>':""),n.addEventListener("mouseenter",()=>{!e.disabled&&this.index!==i&&(this.index=i,this.refresh())}),n.addEventListener("click",r=>{e.disabled||(this.index=i,this.refresh(),e.value&&e.onRight?(e.onRight(),this.refresh(),this.audio&&this.audio.play("menuMove")):e.onConfirm&&(this.audio&&this.audio.play("menuConfirm"),e.onConfirm()),r.stopPropagation())}),this.el.appendChild(n),n}),t.appendChild(this.el),this.refresh(),this.el}refresh(){this.rows.forEach((t,e)=>{t.classList.toggle("sel",e===this.index);const i=this.items[e];i.value&&(t.querySelector(".val").textContent=i.value())})}move(t,e){const i=this.items.length;let n=this.index;for(let r=0;r<i&&(n=n+t,this.wrap?n=(n+i)%i:n=Math.max(0,Math.min(i-1,n)),!!this.items[n].disabled);r++);n!==this.index&&(this.index=n,this.refresh(),e&&e.play("menuMove"))}handle(t,e){this.audio=e,t.up&&this.move(-1,e),t.down&&this.move(1,e);const i=this.items[this.index];return t.left&&i.onLeft&&(i.onLeft(),this.refresh(),e.play("menuMove",{pitch:.9})),t.right&&i.onRight&&(i.onRight(),this.refresh(),e.play("menuMove",{pitch:1.1})),t.confirm&&i.onConfirm?(e.play("menuConfirm"),i.onConfirm(),"confirm"):t.back?"back":null}}function fe(s,t,e){const i=document.createElement(s);return t&&(i.className=t),e!==void 0&&(i.innerHTML=e),i}function cn(s){return`<div class="menu-help">${s.map(([t,e])=>`<b>${t}</b> ${e}`).join(" &nbsp; ")}</div>`}const Kh=[["↑↓","action"],["←→","keyboard / pad"],["A / Enter","rebind"],["B / Esc","back"]];class Vr{constructor(t,e){this.scene=t,this.char=e,this.model=Nh(e),this.anim=new Oh(this.model),this.clips=Fh(Ph(e)),this.anim.play(this.clips.idle,{time:Math.random()*2}),t.add(this.model.group),this.t=0}update(t,e){this.t+=t,this.anim.update(t),this.model.group.rotation.y=e}dispose(){this.scene.remove(this.model.group),this.model.dispose()}}let Ca=null;class Jn{constructor(t){this.G=t,this.root=null}mount(t="screen"){return this.root=fe("div",t),this.G.ui.appendChild(this.root),this.root}enter(){}exit(){this.root&&(this.root.remove(),this.root=null)}update(){}}class Jv extends Jn{enter(){const t=this.G;t.ensureShowcase(0),this.previews=Ie.map((i,n)=>{const r=new Vr(t.scene,i);return r.model.group.position.set((n-2)*2.6,0,0),r}),this.orbit=new Hr(t.camera),this.orbit.radius=11,this.orbit.height=3.2,this.orbit.lookY=1.3,this.orbit.speed=.08,this.orbit.t=.3;const e=this.mount("screen center dim");e.innerHTML=`<div class="title-logo">HOLLOW<br>ARENA<small>five vessels · three arenas</small></div><div class="press">Press any button</div>
      <div class="title-roster">Wisp · Needle · Ember · Bulwark · Pale</div>`,this.t=0,e.addEventListener("click",()=>this.go())}go(){this.G.audio.unlock(),this.G.audio.flushPending(),this.G.audio.play("menuConfirm"),this.G.go("main")}update(t){this.t+=t,this.orbit.update(t),this.previews.forEach((e,i)=>e.update(t,Math.sin(this.orbit.t)*.6+(i-2)*.08)),this.G.stage.update(t),this.t>.3&&this.G.input.anyPressed&&this.go()}exit(){super.exit();for(const t of this.previews)t.dispose();this.previews=[]}}class Qv extends Jn{enter(){const t=this.G;t.ensureShowcase(0),t.audio.setMusic("menu"),this.previews=Ie.map((r,a)=>{const o=new Vr(t.scene,r);return o.model.group.position.set((a-2)*2.6,0,0),o}),this.orbit=new Hr(t.camera),this.orbit.radius=11,this.orbit.height=3.2,this.orbit.lookY=1.3,this.orbit.speed=.08,this.orbit.t=.3;const e=this.mount("screen center dim"),i=fe("div","panel","<h1>HOLLOW ARENA</h1>");this.list=new Un([{label:"Solo Battle",onConfirm:()=>t.go("setup",{mode:"solo"})},{label:"Survival Mode",onConfirm:()=>t.go("setup",{mode:"survival"})},{label:"Controls",onConfirm:()=>this.showControls()}]),this.list.mount(i);const n=Ko();i.appendChild(fe("div","menu-note",`Solo: rounds against one to three CPU vessels. Survival: endless waves that grow in number, vitality and skill.${n.wave?`<br>Best survival run: wave ${n.wave} · ${n.score.toLocaleString()} pts`:""}`)),e.appendChild(i),e.insertAdjacentHTML("beforeend",cn([["↑↓","select"],["A / Enter","confirm"]])),this.controlsOpen=!1,this.ctl=null}showControls(){this.controlsOpen=!0,this.ctlEl=fe("div","screen center veil");const t=fe("div","panel wide","<h1>CONTROLS</h1>");this.ctl=new Dh(this.G.input,this.G.audio,{monitor:!0}),this.ctl.mount(t),this.ctl.setActive(!0),this.ctlEl.appendChild(t),this.ctlEl.insertAdjacentHTML("beforeend",cn(Kh)),this.ctlEl.addEventListener("click",e=>{e.target===this.ctlEl&&!this.G.input.capturing&&this.hideControls()}),this.G.ui.appendChild(this.ctlEl)}hideControls(){this.ctl&&(this.ctl.destroy(),this.ctl=null),this.ctlEl&&(this.ctlEl.remove(),this.ctlEl=null),this.controlsOpen=!1}update(t){this.orbit.update(t),this.previews.forEach((i,n)=>i.update(t,Math.sin(this.orbit.t)*.6+(n-2)*.08)),this.G.stage.update(t);const e=this.G.input.anyNav();if(this.controlsOpen){this.ctl.updateMonitor(),this.ctl.active||this.ctl.setActive(!0),this.ctl.handle(e)==="exit"&&(this.G.audio.play("menuBack"),this.hideControls());return}this.list.handle(e,this.G.audio)}exit(){super.exit(),this.hideControls();for(const t of this.previews)t.dispose();this.previews=[]}}function tx(s){return Gr.map(t=>({label:`Power-up: ${Yo[t].name}`,value:()=>s.powerups[t]?"On":"Off",onLeft:()=>{s.powerups[t]=!s.powerups[t],Ic(s.powerups)},onRight:()=>{s.powerups[t]=!s.powerups[t],Ic(s.powerups)}}))}class ex extends Jn{enter({mode:t}){const e=this.G,i=e.config;i.mode=t,i.slots[0].type="human",t==="solo"?(i.cpuCount===void 0&&(i.cpuCount=1),this.applyCpuCount()):(i.slots[1].type="off",i.slots[2].type="off",i.slots[3].type="off"),e.ensureShowcase(0),this.previews=Ie.map((h,u)=>{const d=new Vr(e.scene,h);return d.model.group.position.set((u-2)*2.6,0,0),d}),this.orbit=new Hr(e.camera),this.orbit.radius=11,this.orbit.height=3.2,this.orbit.lookY=1.3,this.orbit.speed=.08,this.orbit.t=.3;const n=this.mount("screen center dim"),r=fe("div","panel",`<h1>${t==="solo"?"SOLO BATTLE":"SURVIVAL MODE"}</h1>`),a=Rs.map(h=>h.name),o=(h,u,d)=>h[(h.indexOf(u)+d+h.length)%h.length],l=[];if(t==="solo"){l.push({label:"Opponents",value:()=>`${i.cpuCount} CPU`,onLeft:()=>{i.cpuCount=Math.max(1,i.cpuCount-1),this.applyCpuCount()},onRight:()=>{i.cpuCount=Math.min(3,i.cpuCount+1),this.applyCpuCount()}}),l.push({label:"CPU Difficulty",value:()=>a[i.difficulty],onLeft:()=>{i.difficulty=(i.difficulty+3)%4},onRight:()=>{i.difficulty=(i.difficulty+1)%4}}),l.push({label:"Rounds to win",value:()=>String(i.winsNeeded),onLeft:()=>{i.winsNeeded=Math.max(1,i.winsNeeded-1)},onRight:()=>{i.winsNeeded=Math.min(3,i.winsNeeded+1)}});const h=[60,99,1/0];l.push({label:"Round time",value:()=>i.roundTime===1/0?"∞":String(i.roundTime),onLeft:()=>{i.roundTime=o(h,i.roundTime,-1)},onRight:()=>{i.roundTime=o(h,i.roundTime,1)}}),l.push({label:"Power-up drops",value:()=>i.powerupsSolo?"On":"Off",onLeft:()=>{i.powerupsSolo=!i.powerupsSolo},onRight:()=>{i.powerupsSolo=!i.powerupsSolo}}),l.push({label:"Choose Vessels ›",onConfirm:()=>e.go("charSelect")})}else l.push(...tx(i)),l.push({label:"Choose Vessel ›",onConfirm:()=>e.go("charSelect")});if(this.list=new Un(l),this.list.mount(r),t==="survival"){const h=Ko();r.appendChild(fe("div","menu-note",`Endless waves of random vessels. Every wave brings more of them with more vitality, and the CPUs climb from Easy to Normal to Hard. Clearing a wave restores a quarter of your health. Power-ups drop from fallen vessels and appear on the floor now and then.<br><b>${h.wave?`Best run: wave ${h.wave} · ${h.kills} defeated · ${h.score.toLocaleString()} pts`:"No run recorded yet"}</b>`))}else r.appendChild(fe("div","menu-note","Power-up drops use the Health / Attack / Invincibility toggles from the Survival setup."));const c=fe("div","device-line");this.deviceLine=c,r.appendChild(c),n.appendChild(r),n.insertAdjacentHTML("beforeend",cn([["↑↓","select"],["←→","change"],["A / Enter","confirm"],["B / Esc","back"]]))}applyCpuCount(){const t=this.G.config;t.slots[1].type="cpu",t.slots[2].type=t.cpuCount>=2?"cpu":"off",t.slots[3].type=t.cpuCount>=3?"cpu":"off"}update(t){this.orbit.update(t),this.previews.forEach((n,r)=>n.update(t,Math.sin(this.orbit.t)*.6+(r-2)*.08)),this.G.stage.update(t);const e=this.G;this.deviceLine.innerHTML=`Device — <b>${e.input.players[0].deviceLabel}</b>`,this.list.handle(e.input.anyNav(),e.audio)==="back"&&(e.audio.play("menuBack"),e.go("main"))}exit(){super.exit();for(const t of this.previews)t.dispose();this.previews=[]}}class ix extends Jn{enter(){const t=this.G,e=t.config;this.pickers=[],e.slots.forEach((a,o)=>{a.type!=="off"&&this.pickers.push({slot:o,type:a.type,cursor:e.lastCursor&&e.lastCursor[o]!==void 0?e.lastCursor[o]:o%5,locked:!1,charId:null,preview:null,previewId:null,cycleT:0,lockT:0})}),this.humans=this.pickers.filter(a=>a.type==="human"),this.cpus=this.pickers.filter(a=>a.type==="cpu"),t.ensureShowcase(this.pickers.length),this.solo=this.pickers.length===1;const i=this.solo?-1.6:0;t.camera.position.set(i,2.6,this.pickers.length<=2?8.5:9.5),t.camera.lookAt(i,1.3,0);const n=this.mount("screen");n.innerHTML='<div class="cs-header">CHOOSE YOUR VESSEL</div>',this.grid=fe("div","cs-grid"),this.tiles=[...Ie.map(a=>({id:a.id,glyph:a.glyph,name:a.name})),{id:"random",glyph:"?",name:"RANDOM"}].map((a,o)=>{const l=fe("div","cs-tile"+(a.id==="random"?" random":""),`<div class="cursors"></div><div class="glyph">${a.glyph}</div><div class="nm">${a.name}</div>`);return l.addEventListener("click",()=>{const c=this.activeMousePicker();c&&(c.cursor===o&&!c.locked?this.lock(c):(c.cursor=o,c.locked=!1,this.G.audio.play("menuMove")))}),this.grid.appendChild(l),l}),n.appendChild(this.grid),this.compact=this.pickers.length>2,this.infos=this.pickers.map((a,o)=>{const l=fe("div","cs-info "+["tl","tr","bl","br"][o]);return n.appendChild(l),l});const r=`${ys(t.input.bindings.keyboard.special[0])} / ${xs(t.input.bindings.pad.special[0],t.input.padId)}`;n.insertAdjacentHTML("beforeend",cn([["←→","choose"],["A / Enter","lock in"],["B / Esc","undo / back"],[r,"random"]])),this.doneT=0,this.t=0,this.pickers.forEach((a,o)=>{a.previews=new Map;for(const l of Ie){const c=new Vr(t.scene,l);c.model.group.position.set(t.stage.pedestals[o].x,.35,0),c.model.group.visible=!1,a.previews.set(l.id,c)}}),this.render()}activeMousePicker(){const t=this.humans.find(e=>!e.locked);return t||this.cpus.find(e=>!e.locked)||null}charFor(t){return t.cursor<5?Ie[t.cursor]:null}lock(t){t.locked||(t.locked=!0,t.lockT=this.t,t.charId=t.cursor<5?Ie[t.cursor].id:Ie[Math.floor(Math.random()*Ie.length)].id,this.G.audio.play("menuConfirm"),t.preview&&t.previewId===t.charId&&t.preview.anim.play(t.preview.clips.win,{restart:!0,blend:.2}))}unlock(t){t.locked&&(t.locked=!1,t.charId=null,this.G.audio.play("menuBack"),t.preview&&t.preview.anim.play(t.preview.clips.idle,{blend:.3}))}handlePicker(t,e,i){if(t.locked||(e.left&&(t.cursor=(t.cursor+5)%6,this.G.audio.play("menuMove")),e.right&&(t.cursor=(t.cursor+1)%6,this.G.audio.play("menuMove")),e.confirm&&this.lock(t)),e.back){if(t.locked)this.cpus.some(n=>n.locked)||this.unlock(t);else if(i){const n=this.humans.slice().reverse().find(r=>r.locked);if(n)this.unlock(n);else return this.G.audio.play("menuBack"),this.G.go("setup",{mode:this.G.config.mode}),!0}}return!1}update(t){const e=this.G;this.t+=t,e.stage.update(t);const i=e.input,n=this.humans.every(l=>l.locked);let r=!1;for(const l of this.humans){const c=i.players[0],h=c.nav;if(c.pressed.special&&!l.locked&&(l.cursor=5,this.lock(l)),this.handlePicker(l,h,l===this.humans[0])){r=!0;break}}if(r)return;const a=n&&this.humans.every(l=>l.locked),o=i.players[0];if(a){const l=this.cpus.find(h=>!h.locked),c=o.nav;if(l){if(c.left&&(l.cursor=(l.cursor+5)%6,e.audio.play("menuMove")),c.right&&(l.cursor=(l.cursor+1)%6,e.audio.play("menuMove")),(c.confirm||o.pressed.special)&&(o.pressed.special&&(l.cursor=5),this.lock(l)),c.back){const h=this.cpus.slice().reverse().find(u=>u.locked);h?this.unlock(h):this.unlock(this.humans[this.humans.length-1])}}else if(c.back){const h=this.cpus.slice().reverse().find(u=>u.locked);h?this.unlock(h):this.unlock(this.humans[this.humans.length-1])}}if(this.pickers.forEach((l,c)=>{let h=l.locked?l.charId:l.cursor<5?Ie[l.cursor].id:null;h===null&&(l.cycleT+=t,h=Ie[Math.floor(l.cycleT*4)%Ie.length].id),l.previewId!==h&&(l.preview&&(l.preview.model.group.visible=!1),l.preview=l.previews.get(h),l.previewId=h,l.preview.model.group.visible=!0,l.preview.anim.play(l.locked?l.preview.clips.win:l.preview.clips.idle,{restart:!0,blend:0})),l.preview.update(t,Math.sin(this.t*.5+c)*.35)}),this.render(),this.pickers.every(l=>l.locked)){if(this.doneT+=t,this.doneT>.75){e.config.chars=e.config.slots.map((l,c)=>{const h=this.pickers.find(u=>u.slot===c);return h?h.charId:null}),e.config.lastCursor={};for(const l of this.pickers)e.config.lastCursor[l.slot]=l.cursor;e.go("stageSelect")}}else this.doneT=0}render(){const t=this.humans.every(i=>i.locked),e=t?this.cpus.find(i=>!i.locked):null;this.tiles.forEach((i,n)=>{const r=i.querySelector(".cursors");r.innerHTML="";let a=!1,o=!1;for(const l of this.pickers){if(l.cursor!==n||l.type==="cpu"&&!l.locked&&l!==e)continue;const c=l.type==="human"?"YOU":"CPU";r.insertAdjacentHTML("beforeend",`<span class="cur" style="background:${Cr[l.slot]}">${c}</span>`),a=!0,l.locked&&(o=!0)}i.classList.toggle("hl",a),i.classList.toggle("locked",o)}),this.pickers.forEach((i,n)=>{const r=i.locked?Lh(i.charId):this.charFor(i),a=Cr[i.slot],o=i.type==="human"?"YOU":`CPU ${i.slot+1}`,l=i.locked?"READY":i.type==="cpu"&&!t?"WAITING":i===e?"YOU CHOOSE":"SELECTING",c=h=>`<div class="st"><i style="width:${h*20}%"></i></div>`;this.infos[n].className="cs-info "+["tl","tr","bl","br"][n]+(i.locked?" ready":"")+(this.solo?" solo":"")+(this.compact?" compact":""),this.infos[n].innerHTML=`<div class="who" style="background:${a}">${o}</div>`+(r?`<div class="nm">${r.name}</div><div class="ti">${r.title}</div><div class="bl">${r.blurb}</div>
           <div class="stats"><span>Power</span>${c(r.stats.power)}<span>Speed</span>${c(r.stats.speed)}<span>Vitality</span>${c(r.stats.vitality)}<span>Reach</span>${c(r.stats.reach)}</div>`:'<div class="nm">RANDOM</div><div class="ti">fate decides</div>')+`<div class="status">${l}</div>`})}exit(){super.exit();for(const t of this.pickers)if(t.previews)for(const e of t.previews.values())e.dispose()}}class nx extends Jn{enter(){const t=this.G;this.index=Math.max(0,Pn.findIndex(i=>i.id===t.config.stage));const e=this.mount("screen");e.innerHTML='<div class="cs-header">CHOOSE THE ARENA</div>',this.cards=fe("div","ss-cards"),this.cardEls=Pn.map((i,n)=>{const r=fe("div","ss-card",`<div class="nm">${i.name}</div><div class="ds">${i.desc}</div><div class="sw" style="background:${i.swatch}"></div>`);return r.addEventListener("click",()=>{this.index===n?this.confirm():(this.index=n,this.G.audio.play("menuMove"),this.refresh())}),this.cards.appendChild(r),r}),e.appendChild(this.cards),e.insertAdjacentHTML("beforeend",cn([["←→","choose"],["A / Enter","fight"],["B / Esc","back"]])),this.orbit=new Hr(t.camera),this.orbit.radius=21,this.orbit.height=7,this.orbit.lookY=1.5,this.orbit.speed=.1,this.built=null,this.refresh()}refresh(){this.cardEls.forEach((e,i)=>e.classList.toggle("hl",i===this.index));const t=Pn[this.index].id;this.built!==t&&(this.G.setStage(t),this.built=t,this.G.audio.setMusic(Pn[this.index].music))}confirm(){this.G.config.stage=Pn[this.index].id,this.G.audio.play("menuConfirm"),this.G.go("match")}update(t){this.orbit.update(t),this.G.stage.update(t);const e=this.G.input.anyNav();e.left&&(this.index=(this.index+2)%3,this.G.audio.play("menuMove"),this.refresh()),e.right&&(this.index=(this.index+1)%3,this.G.audio.play("menuMove"),this.refresh()),e.confirm&&this.confirm(),e.back&&(this.G.audio.play("menuBack"),this.G.go("charSelect"))}}class sx extends Jn{enter(){const t=this.G,e=t.config;t.setStage(e.stage),t.audio.setMusic(Pn.find(o=>o.id===e.stage).music);const i=e.chars.map(o=>o?Lh(o):null);this.survival=e.mode==="survival";const n=this.survival||e.powerupsSolo?e.powerups:{health:!1,attack:!1,invincible:!1},r={scene:t.scene,camera:t.camera,input:t.input,audio:t.audio,hud:t.hud,particles:t.particles,config:{...e,powerups:n},chars:i,difficulty:Rs[e.difficulty],onEnd:o=>this.showResults(o)};this.match=this.survival?new Zv(r):new Xh(r),this.match.warm(t.renderer,t.camera),this.match.startRound(),this.mount("screen"),this.root.style.pointerEvents="none",this.paused=!1,this.pauseEl=null,this.resultsEl=null,this.ctl=null;const a=document.getElementById("hint");a.textContent=`${t.input.players[0].deviceLabel}   ·   stand still to guard · throw beats guard · sidestep while hit = Substitution   ·   Esc / Start: pause, controls and remapping`,a.style.opacity="0.7",clearTimeout(Ca),Ca=setTimeout(()=>{a.style.opacity="0"},6e3)}openPause(){if(this.paused||this.resultsEl)return;this.paused=!0,this.G.audio.play("menuConfirm"),document.getElementById("hint").style.opacity="0",this.pauseEl=fe("div","screen center veil");const t=fe("div","panel pause",'<div class="pause-title">PAUSED</div>'),e=fe("div","pause-body"),i=fe("div","pause-menu"),n=fe("div","pause-controls");e.appendChild(i),e.appendChild(n),t.appendChild(e),this.ctl=new Dh(this.G.input,this.G.audio,{monitor:!0}),this.ctl.mount(n),this.pauseList=new Un([{label:"Resume",onConfirm:()=>this.closePause()},{label:"Remap Controls",onConfirm:()=>this.ctl.setActive(!0)},{label:this.survival?"Restart Run":"Restart Match",onConfirm:()=>this.guarded("Restart",()=>{this.closePause(),this.G.go("match")})},{label:"Character Select",onConfirm:()=>this.guarded("Abandon run",()=>{this.closePause(),this.G.go("charSelect")})},{label:"Main Menu",onConfirm:()=>this.guarded("Abandon run",()=>{this.closePause(),this.G.go("main")})}]),this.pauseLeft=i,this.confirmList=null,this.confirmEl=null,this._ctlWasActive=!1,this.pauseList.mount(i),this.pauseEl.appendChild(t),this.pauseHelp=fe("div"),this.pauseEl.appendChild(this.pauseHelp),this.setPauseHelp(!1),this.G.ui.appendChild(this.pauseEl)}setPauseHelp(t){this.pauseHelp&&(this.pauseHelp.innerHTML=cn(t?Kh:[["↑↓","select"],["A / Enter","confirm"],["Start / Esc","resume"],["click a key","rebind"]]))}guarded(t,e){const i=this.match;if(!(this.survival&&i.phase!=="done"&&(i.wave>1||i.kills>0))){e();return}this.pauseList.el.classList.add("hidden"),this.confirmEl=fe("div","pause-confirm",`<div class="pause-title">ABANDON RUN?</div><div class="menu-note">Wave ${i.wave} · ${i.kills} defeated · ${i.score.toLocaleString()} pts</div>`),this.confirmList=new Un([{label:"Keep fighting",onConfirm:()=>this.unguard()},{label:t,onConfirm:()=>{i.abandon(),e()}}]),this.confirmList.mount(this.confirmEl),this.pauseLeft.appendChild(this.confirmEl)}unguard(){this.confirmEl&&(this.confirmEl.remove(),this.confirmEl=null,this.confirmList=null),this.pauseList&&this.pauseList.el&&this.pauseList.el.classList.remove("hidden")}closePause(){this.ctl&&(this.ctl.destroy(),this.ctl=null),this.pauseEl&&(this.pauseEl.remove(),this.pauseEl=null),this.confirmEl=null,this.confirmList=null,this.paused=!1}showResults(t){const e=this.G;this.resultsEl=fe("div","screen center veil results");let i;if(t.survival){const n=t.newBest?'<span class="newbest">NEW BEST RUN</span>':`Best: wave ${t.best.wave} · ${t.best.score.toLocaleString()} pts`;i=fe("div","panel",`<div class="pause-title">SURVIVAL OVER</div><div class="winner">WAVE ${t.wave}</div><div class="sub">${t.kills} vessel${t.kills===1?"":"s"} defeated   ·   ${Ih(t.time)} survived   ·   ${t.score.toLocaleString()} pts</div><div class="best">${n}</div>`),this.resultsList=new Un([{label:"Try Again",onConfirm:()=>e.go("match")},{label:"Character Select",onConfirm:()=>e.go("charSelect")},{label:"Change Arena",onConfirm:()=>e.go("stageSelect")},{label:"Main Menu",onConfirm:()=>e.go("main")}])}else{const n=t.winner,r=n?n.isCPU?`CPU ${n.slot+1}`:"PLAYER":"";i=fe("div","panel",`<div class="winner" style="color:${n?Cr[n.slot]:"#fff"}">${n?n.name:"NO ONE"}</div><div class="sub">${n?r+" takes the arena":"The arena stands empty"}</div>`),this.resultsList=new Un([{label:"Rematch",onConfirm:()=>e.go("match")},{label:"Character Select",onConfirm:()=>e.go("charSelect")},{label:"Change Arena",onConfirm:()=>e.go("stageSelect")},{label:"Main Menu",onConfirm:()=>e.go("main")}])}this.resultsList.mount(i),this.resultsEl.appendChild(i),this.resultsEl.insertAdjacentHTML("beforeend",cn([["↑↓","select"],["A / Enter","confirm"]])),e.ui.appendChild(this.resultsEl),this.resultsT=0}update(t){const e=this.G;if(this.paused||e.stage.update(t),this.resultsEl){this.match.update(t),this.resultsT+=t,this.resultsT>1&&this.resultsList.handle(e.input.anyNav(),e.audio);return}if(this.paused){const i=e.input.anyNav(),n=e.input.players[0];if(this.ctl.updateMonitor(),this.ctl.active!==this._ctlWasActive&&(this._ctlWasActive=this.ctl.active,this.setPauseHelp(this.ctl.active),this.pauseList.el&&this.pauseList.el.classList.toggle("dim",this.ctl.active),this.ctl.active&&this.confirmList&&this.unguard()),this.ctl.active){this.ctl.handle(i)==="exit"?e.audio.play("menuBack"):n.pressed.pause&&!n.pressed.confirm&&!n.pressed.back&&!e.input.capturing&&this.closePause();return}const r=n.pressed.pause&&!n.pressed.confirm;if(this.confirmList){const o=this.confirmList.handle(i,e.audio);this.confirmList&&(o==="back"||r)&&this.unguard();return}const a=this.pauseList.handle(i,e.audio);if(this.confirmList||this.ctl&&this.ctl.active)return;(a==="back"||r)&&this.closePause();return}if(this.match.pausePressed()){this.openPause();return}this.match.update(t)}exit(){super.exit(),this.closePause(),this.resultsEl&&(this.resultsEl.remove(),this.resultsEl=null),this.match.dispose(),clearTimeout(Ca),document.getElementById("hint").style.opacity="0"}}const rx={title:Jv,main:Qv,setup:ex,charSelect:ix,stageSelect:nx,match:sx},ax=document.getElementById("game"),si=new mg({canvas:ax,antialias:!0,powerPreference:"high-performance"});si.setPixelRatio(Math.min(window.devicePixelRatio||1,2));si.shadowMap.enabled=!0;si.shadowMap.type=kc;si.outputColorSpace=ze;si.toneMapping=Fc;si.toneMappingExposure=1.15;const zn=new gg;zn.background=new Ut(329226);const Ps=new We(50,16/9,.1,220);Ps.position.set(0,3,10);const Wr=new fv,Bn=new pv,ox=new vv,hs=new yv(zn,2400),lx=document.getElementById("menu"),ce={renderer:si,scene:zn,camera:Ps,input:Wr,audio:Bn,hud:ox,particles:hs,ui:lx,stage:null,screen:null,screenName:null,config:{mode:"solo",slots:[{type:"human"},{type:"cpu"},{type:"off"},{type:"off"}],cpuCount:1,difficulty:1,winsNeeded:2,roundTime:99,powerups:Gv(),powerupsSolo:!1,chars:[null,null,null,null],stage:"crossroads",lastCursor:null},setStage(s){return ce.stage&&ce.stage.id===s||(ce.stage&&ce.stage.dispose(),hs.clear(),ce.stage=Cv(s,zn,si,hs),ce.stage.id=s),ce.stage},ensureShowcase(s){return(!ce.stage||ce.stage.id!=="showcase")&&(ce.stage&&ce.stage.dispose(),hs.clear(),ce.stage=new Lv(zn,si,hs),ce.stage.id="showcase"),ce.stage.setPedestals(s),ce.stage},go(s,t={}){ce.screen&&ce.screen.exit();const e=rx[s];ce.screenName=s,ce.screen=new e(ce),ce.screen.enter(t)}};function $h(){const s=window.innerWidth,t=window.innerHeight;si.setSize(s,t,!1),Ps.aspect=s/t,Ps.updateProjectionMatrix()}window.addEventListener("resize",$h);$h();Wr.onPadChange=(s,t,e)=>{const i=(e||"Controller").replace(/\(.*$/,"").trim().slice(0,28);Di(t?`${i} connected`:`${i} disconnected`)};window.addEventListener("pointerdown",()=>{Bn.unlock(),Bn.flushPending()},{passive:!0});window.addEventListener("keydown",s=>{Bn.unlock(),Bn.flushPending(),!Wr.capturing&&(s.code==="KeyM"&&!s.repeat&&Di(Bn.toggleMute()?"Muted":"Sound on",1200),s.code==="KeyF"&&!s.repeat&&(document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()))});ce.go("title");let Uc=performance.now(),La=0,mr=0;function jh(s){requestAnimationFrame(jh);let t=(s-Uc)/1e3;Uc=s,t>.1&&(t=.1),Wr.update(t),ce.screen&&ce.screen.update(t),si.render(zn,Ps),La++,mr+=t,mr>=1&&(window.__fps=La/mr,La=0,mr=0)}requestAnimationFrame(jh);window.__G=ce;
