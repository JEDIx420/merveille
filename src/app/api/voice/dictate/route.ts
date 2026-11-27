import { NextResponse } from "next/server";
// Retired optional input: fail before reading audio, reserving quota or invoking AI.
export async function POST() {
 return NextResponse.json({error:"Voice entry is not available. Please type your update.",code:"VOICE_DISABLED"},{status:410});
}
