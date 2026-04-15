const fs = require('fs');

// Read server.ts to extract MOCK_DATABASE
const serverCode = fs.readFileSync('server.ts', 'utf-8');
const match = serverCode.match(/const MOCK_DATABASE = (\[[\s\S]*?\]);\n/);
if (!match) {
  console.log("MOCK_DATABASE not found");
  process.exit(1);
}

const MOCK_DATABASE = eval(match[1]);

console.log("Total DB instances:", MOCK_DATABASE.length);

const config = {
  database: {
    engine: "PostgreSQL",
    vcpu: 2,
    ram: 4,
    family: "Any"
  }
};

const filtered = MOCK_DATABASE.filter(p => {
  const matchEngine = !config.database.engine || p.db_engine === config.database.engine;
  const matchVcpu = !config.database.vcpu || (Number(p.vcpu) || 0) >= config.database.vcpu;
  const matchRam = !config.database.ram || (Number(p.memory_gb) || 0) >= config.database.ram;
  const matchFamily = !config.database.family || config.database.family === "Any" || p.instance_class === config.database.family || (p.instance_class && p.instance_class.startsWith(`${config.database.family}.`));
  
  return matchEngine && matchVcpu && matchRam && matchFamily;
});

console.log("Filtered DB instances:", filtered.length);
if (filtered.length > 0) {
  console.log("First match:", filtered[0]);
}
