const express=require("express");
const cors=require("cors");
const crypto=require("crypto");
const app=express();
app.use(cors());
app.use(express.json());

const PORT=process.env.PORT||10000;
const keys=new Map();
const TTL=12*60*60*1000;

function newKey(){
  return "USER-"+crypto.randomBytes(4).toString("hex").toUpperCase();
}

app.get("/",(req,res)=>res.json({ok:true,service:"BIRUXY access API"}));

app.post("/api/keys",(req,res)=>{
  const key=newKey();
  const expires=Date.now()+TTL;
  keys.set(key,expires);
  res.json({key,expiresAt:expires});
});

app.post("/api/keys/verify",(req,res)=>{
  const key=String(req.body?.key||"").trim().toUpperCase();
  const expires=keys.get(key);
  if(!expires){
    return res.status(401).json({valid:false,error:"Invalid username."});
  }
  if(Date.now()>expires){
    keys.delete(key);
    return res.status(401).json({valid:false,error:"Username expired."});
  }
  res.json({valid:true,expiresAt:expires});
});

app.listen(PORT,()=>console.log(`BIRUXY API listening on ${PORT}`));
