import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const dir=await mkdtemp(path.join(process.cwd(),".mq-sender-test-"));
await build({ entryPoints:["workers/email-sender.ts"], outfile:path.join(dir,"sender.mjs"),
  platform:"node",target:"node22",format:"esm",bundle:true,packages:"external" });
const sender=await import(pathToFileURL(path.join(dir,"sender.mjs")).href);
test.after(async()=>rm(dir,{recursive:true,force:true}));

const basic={from:"ceo@international.mahquantum.tech",to:"colleague@example.com",
  subject:"Project update",text:"Testing sender",html:"<p>Testing sender</p>"};

test("Brevo payload sends FROM the international CEO mailbox",()=>{
  const x=sender.buildBrevoMessage(basic);
  assert.deepEqual(x.sender,{email:"ceo@international.mahquantum.tech"});
  assert.deepEqual(x.to,[{email:"colleague@example.com"}]);
  assert.equal(x.subject,"Project update");
  assert.equal(x.textContent,"Testing sender");
});

test("Cannot send using the existing Zoho domain or spoof unrelated addresses",()=>{
  assert.throws(()=>sender.buildBrevoMessage({...basic,from:"ceo@mahquantum.tech"}));
  assert.throws(()=>sender.buildBrevoMessage({...basic,from:"impostor@gmail.com"}));
  assert.throws(()=>sender.buildBrevoMessage({...basic,subject:"Hello\r\nBcc: secret@evil.test"}));
});

test("Recipient CC/BCC and reply-to address are mapped correctly",()=>{
  const x=sender.buildBrevoMessage({...basic,cc:["first@example.com"],bcc:"second@example.com",
    replyTo:"ceo@international.mahquantum.tech"});
  assert.deepEqual(x.cc,[{email:"first@example.com"}]);
  assert.deepEqual(x.bcc,[{email:"second@example.com"}]);
  assert.deepEqual(x.replyTo,{email:"ceo@international.mahquantum.tech"});
});

test("Free sending cannot be used unless a Brevo secret is configured",async()=>{
  await assert.rejects(()=>sender.sendEmail({},basic),/disabled/);
});

test("Valid configured account receives provider acceptance identifier",async()=>{
  const previous=globalThis.fetch;
  let intercepted;
  try{
    globalThis.fetch=async (url,options)=>{
      intercepted={url,apiKey:options.headers["api-key"],message:JSON.parse(options.body)};
      return new Response(JSON.stringify({messageId:"brevo-provider-123"}),{status:201});
    };
    const result=await sender.sendEmail({BREVO_API_KEY:"example-secret"},basic);
    assert.deepEqual(result,{messageId:"brevo-provider-123"});
    assert.equal(intercepted.url,"https://api.brevo.com/v3/smtp/email");
    assert.equal(intercepted.apiKey,"example-secret");
    assert.equal(intercepted.message.sender.email,basic.from);
  }finally{globalThis.fetch=previous;}
});

test("Provider rejection does not claim delivery succeeded",async()=>{
  const prior=globalThis.fetch;
  try{
    globalThis.fetch=async()=>new Response(JSON.stringify({message:"rejected"}),{status:403});
    await assert.rejects(()=>sender.sendEmail({BREVO_API_KEY:"fake"},basic),/did not accept/);
  }finally{globalThis.fetch=prior;}
});
