/** Runtime-derived 6-frame sheet preserves 210x362 sprite/lip geometry. */
export const FACE_ATLAS_KEY='ramin-face-atlas-v2';
export const FACIAL_FRAME_WIDTH=210;
export const FACIAL_FRAME_HEIGHT=362;
export const FACE_FRAME_INDEX={
 idle:0,blink:1,surprised:2,victory:3,wink:4,serious:5,
} as const;
export type FaceFrame=keyof typeof FACE_FRAME_INDEX;

/** Expressive pixels come from the supplied sprites, not duplicate overlays.
 * Crop stays strictly above the upper lip (frame Y=136).
 */
export const FACE_PATCHES={
 wink:{x:62,y:101,width:47,height:27},
 serious:{x:60,y:83,width:97,height:27},
} as const;
export function facialPatchIsSafe(rect:{x:number;y:number;width:number;height:number}):boolean{
 return rect.x>=0&&rect.y>=0&&rect.width>0&&rect.height>0&&
 rect.x+rect.width<=FACIAL_FRAME_WIDTH&&
 rect.y+rect.height<136;
}
