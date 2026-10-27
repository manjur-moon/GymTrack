import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL!})});
type SeedItem = {slug:string;name:string;muscle:string;pattern:string;gear:string[];type?:string;level?:string};
const entries = ([
 ["barbell-bench-press","Barbell Bench Press","CHEST","HORIZONTAL_PUSH","BARBELL,BENCH","REPS_WEIGHT","INTERMEDIATE"],
 ["dumbbell-bench-press","Dumbbell Bench Press","CHEST","HORIZONTAL_PUSH","DUMBBELL,BENCH"],
 ["push-up","Push-Up","CHEST","HORIZONTAL_PUSH","","REPS_ONLY"],
 ["incline-dumbbell-press","Incline Dumbbell Press","CHEST","HORIZONTAL_PUSH","DUMBBELL,BENCH"],
 ["cable-fly","Cable Chest Fly","CHEST","ISOLATION","CABLE"],
 ["pull-up","Pull-Up","BACK","VERTICAL_PULL","PULL_UP_BAR","REPS_ONLY","INTERMEDIATE"],
 ["dumbbell-row","One-Arm Dumbbell Row","BACK","HORIZONTAL_PULL","DUMBBELL"],
 ["barbell-row","Barbell Row","BACK","HORIZONTAL_PULL","BARBELL","REPS_WEIGHT","INTERMEDIATE"],
 ["lat-pulldown","Lat Pulldown","BACK","VERTICAL_PULL","CABLE"],
 ["seated-cable-row","Seated Cable Row","BACK","HORIZONTAL_PULL","CABLE"],
 ["overhead-press","Dumbbell Overhead Press","SHOULDERS","VERTICAL_PUSH","DUMBBELL"],
 ["lateral-raise","Lateral Raise","SHOULDERS","ISOLATION","DUMBBELL"],
 ["face-pull","Face Pull","SHOULDERS","HORIZONTAL_PULL","CABLE"],
 ["barbell-squat","Barbell Back Squat","QUADRICEPS","SQUAT","BARBELL,RACK","REPS_WEIGHT","INTERMEDIATE"],
 ["goblet-squat","Goblet Squat","QUADRICEPS","SQUAT","DUMBBELL"],
 ["bodyweight-squat","Bodyweight Squat","QUADRICEPS","SQUAT","","REPS_ONLY"],
 ["walking-lunge","Walking Lunge","QUADRICEPS","LUNGE","","REPS_ONLY"],
 ["romanian-deadlift","Romanian Deadlift","HAMSTRINGS","HINGE","BARBELL","REPS_WEIGHT","INTERMEDIATE"],
 ["dumbbell-rdl","Dumbbell Romanian Deadlift","HAMSTRINGS","HINGE","DUMBBELL"],
 ["hip-thrust","Hip Thrust","GLUTES","HINGE","BARBELL,BENCH"],
 ["glute-bridge","Glute Bridge","GLUTES","HINGE","","REPS_ONLY"],
 ["calf-raise","Standing Calf Raise","CALVES","ISOLATION","","REPS_ONLY"],
 ["biceps-curl","Dumbbell Biceps Curl","BICEPS","ISOLATION","DUMBBELL"],
 ["hammer-curl","Hammer Curl","BICEPS","ISOLATION","DUMBBELL"],
 ["triceps-pushdown","Triceps Pushdown","TRICEPS","ISOLATION","CABLE"],
 ["overhead-extension","Overhead Triceps Extension","TRICEPS","ISOLATION","DUMBBELL"],
 ["plank","Plank","CORE","CORE","","DURATION"],
 ["dead-bug","Dead Bug","CORE","CORE","","REPS_ONLY"],
 ["russian-twist","Russian Twist","CORE","CORE","","REPS_ONLY"],
 ["farmer-carry","Farmer Carry","FULL_BODY","CARRY","DUMBBELL","DISTANCE_WEIGHT"]
] as Array<[string,string,string,string,string,string?,string?]>).map(([slug,name,muscle,pattern,gear,type,level]):SeedItem=>({slug,name,muscle,pattern,gear:gear.split(",").filter(Boolean),type,level}));

async function main() {
 for(const e of entries)await prisma.exercise.upsert({where:{slug:e.slug},create:{slug:e.slug,name:e.name,muscle:e.muscle as never,pattern:e.pattern as never,equipment:e.gear as never,trackingType:(e.type??"REPS_WEIGHT") as never,difficulty:(e.level??"BEGINNER") as never,steps:["Set up with a controlled posture.","Perform each repetition smoothly.","Return under control."],commonMistakes:["Rushing repetitions","Choosing an unsuitable weight"]},update:{name:e.name}});
 const demo=await prisma.user.upsert({where:{email:"demo@gymtrack.local"},create:{email:"demo@gymtrack.local",name:"Demo Athlete",isDemo:true,profile:{create:{goal:"BUILD_STRENGTH",level:"INTERMEDIATE",daysPerWeek:3,equipment:["BARBELL","BENCH","RACK","DUMBBELL"]}}},update:{name:"Demo Athlete",isDemo:true}});
 if((await prisma.plan.count({where:{userId:demo.id}}))===0){
  const lookup=async(slug:string)=>(await prisma.exercise.findUniqueOrThrow({where:{slug}})).id;
  const bench=await lookup("barbell-bench-press"),squat=await lookup("barbell-squat"),row=await lookup("dumbbell-row"),plank=await lookup("plank");
  const plan=await prisma.plan.create({data:{userId:demo.id,name:"Strength Foundations",goal:"BUILD_STRENGTH",status:"ACTIVE",days:{create:[
   {dayNumber:1,name:"Upper Body Strength",exercises:{create:[{exerciseId:bench,sortOrder:1,targetSets:3,targetRepsMin:5,targetRepsMax:8,restSeconds:120},{exerciseId:row,sortOrder:2,targetSets:3,targetRepsMin:8,targetRepsMax:12,restSeconds:90},{exerciseId:plank,sortOrder:3,targetSets:2,targetDurationSeconds:40,restSeconds:60}]}},
   {dayNumber:2,name:"Lower Body Strength",exercises:{create:[{exerciseId:squat,sortOrder:1,targetSets:3,targetRepsMin:5,targetRepsMax:8,restSeconds:120},{exerciseId:plank,sortOrder:2,targetSets:2,targetDurationSeconds:40,restSeconds:60}]}}
  ]}},include:{days:{include:{exercises:true}}}});
  for(let i=0;i<12;i++){
   const day=plan.days[i%2];const end=new Date(Date.now()-(11-i)*4*86400000);
   const session=await prisma.workoutSession.create({data:{userId:demo.id,planDayId:day.id,status:"COMPLETED",startedAt:new Date(end.getTime()-40*60000),completedAt:end}});
   for(const exercise of day.exercises)for(let n=1;n<=exercise.targetSets;n++){
    const duration=exercise.exerciseId===plank;
    const weight=duration?undefined:exercise.exerciseId===row?20+i:exercise.exerciseId===bench?50+i*1.5:75+i*2;
    await prisma.setLog.create({data:{sessionId:session.id,planExerciseId:exercise.id,exerciseId:exercise.exerciseId,setNumber:n,isWarmup:false,reps:duration?null:6+i%3,weightKg:weight,durationSeconds:duration?40+i%4*5:null,rpe:7.5}});
   }
  }
  for(let i=0;i<10;i++){
   const t=new Date(Date.now()-(9-i)*7*86400000);
   const recordedOn=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate()));
   await prisma.bodyWeightEntry.upsert({where:{userId_recordedOn:{userId:demo.id,recordedOn}},create:{userId:demo.id,recordedOn,weightKg:76-i*.3},update:{weightKg:76-i*.3}});
  }
 }
 console.log(`Seed complete: ${entries.length} exercises + read-only demo with 12 workouts`);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
