/** Pixel masks traced from the approved classic, curled and walrus artwork.
 * 72×40, 2-bit palette, one byte per run: [shade:2][runLengthMinusOne:6].
 */
export const MUSTACHE_WIDTH=72;
export const MUSTACHE_HEIGHT=40;
export const MUSTACHE_NAMES=['CLASSIC','CURL','WALRUS'] as const;
const DATA=["Pz8/Pz8/Pz8/Pz8/Pz8/AUYFRjNHA0cuRMOBQgFCgcNEJkSAwoDAg0WDxIBEIkWAwYZFhcGBRBNCB0SBw4VJgECDxYBFB0IDQwZCgMOFUYXDQwZDA0uBwYdThcCAwIJLBESHZYhFB0OFUwFRgECERAldAV0LWAdYEU0VTRZMFUw/Pz8/Pz8/Pz8/Pz8/PzM=","Pz8/Pz8/Pz8/BkYrRgtChEEpQYBBgUIJSShCgEKAQgdCgEIBQIFAJ0CAQQFCgEIERwFBgEANQwNDDUMCRgNCgEEBRQpCwYFDgsBCCkUBQoFAA0QCRAtCg0OCwEILRAJAgkADRAJECULEgUKCwYFBCUQCQIJAA0QEQQlBw4RBhMJCCUEEQIBAgEADRBBAwYVAgEOFwUEPRANEDUKAwYVFhcFDDUCAQgNGCkGAQIdIiEELRQNHB0OHS4dDCEGAQwRIA0SCQIBThUMDSAVDgEMDRIJAgFSEQwNDgEMFRIJFg1yERoFEB0SHQIBOAU6EwIDAgUQKQ4dPA06EwYFDC1oEUYFHDFgHWBBSDFMTUg1SFksVSz8/Pz8/Pz8/Pz8U","Pz8mSAdILUgHSClDgcKBRAFEg8GAQyNFwIDCgUQARYPCRSFDxIVHg8ZDH0GBxIDAiEOGwIHDgUAdQoHDikSGxoFCGUOAw4tFhsGDwoBDF0KBwYxHhcGEwYBDFkKBwIXAhUqGwIXAgUMSQojBhkuGwIlCEUKRS4fAiEIPQ4VBhUGAT4FBhEGFQw1DhUGFQYBPgUGEQYVDC0WAQIBChVmDRINECkSARINdg0SBRAlLgl6DSwhMgU8BT4FMB0yBTwFPgUwHXgFeB14CXQVfBF4DXQddA10HXQNXE1cDVxNXA1QZVANUGVQDUh1SA1IdUgNOJU4FSABCJUIASAdDAEMBQSVAAkIBQwdDAEMCQCVAAkIBQwhCAkEtQQJCPz8/HA=="];
export function decodeMustache(style:number):Uint8Array {
  const encoded=DATA[style];
  if(!encoded)throw new RangeError('Unknown mustache style');
  const pixels=new Uint8Array(MUSTACHE_WIDTH*MUSTACHE_HEIGHT);
  let index=0;
  for(const character of atob(encoded)){
    const byte=character.charCodeAt(0);
    const size=(byte&63)+1;
    if(index+size>pixels.length)throw new Error('Invalid sprite data');
    pixels.fill(byte>>6,index,index+size);
    index+=size;
  }
  if(index!==pixels.length)throw new Error('Truncated sprite data');
  return pixels;
}
