import { fetchUsers } from './src/lib/sheets';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  try {
    console.log('Fetching users...');
    const users = await fetchUsers();
    console.log('Users found:', users.map(u => ({ username: u.username, role: u.role, branch: u.fofjBranch })));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
