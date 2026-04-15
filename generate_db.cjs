const instances = [];

function addFamily(family, ratio, sizes) {
  sizes.forEach(size => {
    let vcpu = 0;
    if (size === 'micro') vcpu = 1;
    else if (size === 'small') vcpu = 2;
    else if (size === 'medium') vcpu = 1;
    else if (size === 'large') vcpu = 2;
    else if (size === 'xlarge') vcpu = 4;
    else if (size.endsWith('xlarge')) {
      const mult = parseInt(size.replace('xlarge', ''));
      vcpu = 4 * mult;
    }
    
    let mem = vcpu * ratio;
    if (size === 'micro' && ratio === 4) mem = 1;
    if (size === 'small' && ratio === 4) mem = 2;
    if (size === 'medium' && ratio === 4) mem = 4;
    
    if (size === 'micro' && ratio === 2) mem = 1;
    if (size === 'small' && ratio === 2) mem = 2;
    if (size === 'medium' && ratio === 2) mem = 2;

    instances.push({
      id: `aws-rds-postgres-${family.replace('.', '-')}-${size}`,
      provider_id: "aws-mock",
      region_id: "aws-us-east-1",
      db_engine: "PostgreSQL",
      instance_class: `db.${family}.${size}`,
      vcpu: vcpu,
      memory_gb: mem,
      price_per_hour: vcpu * 0.05
    });
  });
}

const mSizes = ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge', '24xlarge'];
const m4Sizes = ['large', 'xlarge', '2xlarge', '4xlarge', '10xlarge', '16xlarge'];
const cSizes = ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge', '24xlarge'];
const rSizes = ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge', '24xlarge'];

addFamily('m4', 4, m4Sizes);
addFamily('m5', 4, mSizes);
addFamily('m5d', 4, mSizes);
addFamily('m6i', 4, mSizes);
addFamily('m6g', 4, mSizes);
addFamily('m6gd', 4, mSizes);
addFamily('m7i', 4, mSizes);

addFamily('r4', 8, ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge']);
addFamily('r5', 8, rSizes);
addFamily('r5b', 8, rSizes);
addFamily('r5d', 8, rSizes);
addFamily('r6i', 8, rSizes);
addFamily('r6g', 8, rSizes);
addFamily('r6gd', 8, rSizes);
addFamily('r7i', 8, rSizes);

addFamily('c4', 2, ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge']);
addFamily('c5', 2, cSizes);
addFamily('c6i', 2, cSizes);
addFamily('c6gd', 2, ['medium', 'large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge']);

addFamily('t2', 4, ['micro', 'small', 'medium', 'large', 'xlarge']);
addFamily('t3', 4, ['micro', 'small', 'medium', 'large', 'xlarge', '2xlarge']);
addFamily('t4g', 4, ['micro', 'small', 'medium', 'large', 'xlarge', '2xlarge']);

const metals = [
  { family: 'm5', size: 'metal', vcpu: 96, mem: 384 },
  { family: 'm6i', size: 'metal', vcpu: 128, mem: 512 },
  { family: 'm7i', size: 'metal-24xl', vcpu: 96, mem: 384 },
  { family: 'm7i', size: 'metal-48xl', vcpu: 192, mem: 768 },
  { family: 'r5', size: 'metal', vcpu: 96, mem: 768 },
  { family: 'r6i', size: 'metal', vcpu: 128, mem: 1024 }
];

metals.forEach(m => {
  instances.push({
      id: `aws-rds-postgres-${m.family}-${m.size}`,
      provider_id: "aws-mock",
      region_id: "aws-us-east-1",
      db_engine: "PostgreSQL",
      instance_class: `db.${m.family}.${m.size}`,
      vcpu: m.vcpu,
      memory_gb: m.mem,
      price_per_hour: m.vcpu * 0.05
  });
});

instances.unshift({ id: "aws-rds-mysql", provider_id: "aws-mock", region_id: "aws-us-east-1", db_engine: "MySQL", instance_class: "db.t3.micro", vcpu: 2, memory_gb: 1, price_per_hour: 0.017 });
instances.push({ id: "aws-dynamodb", provider_id: "aws-mock", region_id: "aws-us-east-1", db_engine: "DynamoDB", instance_class: "Pay-per-request", vcpu: 0, memory_gb: 0, price_per_hour: 0 });

const fs = require('fs');
fs.writeFileSync('db_instances.json', JSON.stringify(instances, null, 2));
