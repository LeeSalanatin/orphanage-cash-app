
const { fetchUsers } = require('./src/lib/sheets');
require('dotenv').config({ path: '.env.local' });

async function run() {
  try {
    const users = await fetchUsers();
    console.log('--- USERS IN GOOGLE SHEET ---');
    users.forEach(u => {
      console.log(`User: [${u.username}] Pass: [${u.password}] Role: [${u.role}] Branch: [${u.fofjBranch}]`);
    });
    console.log('------------------------------');
  } catch (err) {
    console.error('Error fetching users:', err);
  }
}

run();
