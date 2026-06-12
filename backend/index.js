const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'shepherdcheck-dev-secret-change-in-prod';

// Twilio (optional — SMS works without it, just logs)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('✓ Twilio SMS enabled');
} else {
  console.log('ℹ Twilio not configured — SMS will be logged only');
}

app.use(cors());
app.use(express.json());

// In production, serve the built frontend
const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
const fs = require('fs');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  console.log('✓ Serving frontend from', frontendPath);
}

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ============ Database ============

const db = new Database(path.join(__dirname, 'shepherdcheck.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- Churches (tenants)
  CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, active, suspended
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Staff users
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER REFERENCES tenants(id),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',  -- super_admin, admin, staff
    invited_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Pre-registered families
  CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    parent_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Children linked to families
  CREATE TABLE IF NOT EXISTS children (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    family_id INTEGER NOT NULL REFERENCES families(id),
    name TEXT NOT NULL,
    age TEXT DEFAULT '',
    allergies TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Check-in records
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    family_id INTEGER REFERENCES families(id),
    child_id INTEGER REFERENCES children(id),
    parent_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    kid_name TEXT NOT NULL,
    kid_age TEXT DEFAULT '',
    room TEXT DEFAULT '',
    code TEXT NOT NULL,
    checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    checked_out_at DATETIME DEFAULT NULL,
    notes TEXT DEFAULT '',
    sms_sent INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_checkins_tenant ON checkins(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_checkins_code ON checkins(tenant_id, code);
  CREATE INDEX IF NOT EXISTS idx_families_tenant ON families(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_children_tenant ON children(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_children_family ON children(family_id);
`);

// Create default super admin and demo tenant if none exist
const userCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'super_admin'").get();
if (userCount.c === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
  ).run('admin@shepherdcheck.com', hash, 'Super Admin', 'super_admin');
  
  // Also create a demo church tenant
  const demo = db.prepare(
    'INSERT INTO tenants (name, slug, email, status) VALUES (?, ?, ?, ?)'
  ).run('First Church', 'first-church', 'demo@shepherdcheck.com', 'active');
  
  const demoHash = bcrypt.hashSync('demo123', 10);
  db.prepare(
    'INSERT INTO users (tenant_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
  ).run(demo.lastInsertRowid, 'demo@firstchurch.org', demoHash, 'Demo Admin', 'admin');
  
  console.log('✓ Created super admin: admin@shepherdcheck.com / admin123');
  console.log('✓ Created demo church: demo@firstchurch.org / demo123');
}

// ============ Helpers ============

function generateCode(tenantId) {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const existing = db.prepare(
    'SELECT id FROM checkins WHERE tenant_id = ? AND code = ? AND checked_out_at IS NULL'
  ).get(tenantId, code);
  if (existing) return generateCode(tenantId);
  return code;
}

// Send SMS via Twilio (or log if not configured)
async function sendSms(phone, message) {
  if (!phone) return false;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || '+15005550006';
  if (twilioClient) {
    try {
      await twilioClient.messages.create({ body: message, to: phone, from: fromNumber });
      return true;
    } catch (err) {
      console.error('Twilio error:', err.message);
      return false;
    }
  } else {
    console.log(`[SMS logged] → ${phone}: "${message}"`);
    return false;
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function superAdminOnly(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

// ============ HEALTH CHECK (no auth) ============
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ AUTH ROUTES ============

// Signup — new church requests access
app.post('/api/signup', (req, res) => {
  try {
    const { church_name, email, password, phone } = req.body;
    
    if (!church_name || !email || !password) {
      return res.status(400).json({ error: 'Church name, email, and password are required' });
    }
    
    const slug = church_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    const existing = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);
    if (existing) {
      return res.status(400).json({ error: 'A church with this name already exists' });
    }
    
    const existingEmail = db.prepare(
      'SELECT u.id FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.email = ?'
    ).get(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'This email is already registered' });
    }
    
    const tenantResult = db.prepare(
      'INSERT INTO tenants (name, slug, email, status) VALUES (?, ?, ?, ?)'
    ).run(church_name, slug, email, 'pending');
    
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(
      'INSERT INTO users (tenant_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
    ).run(tenantResult.lastInsertRowid, email, hash, church_name + ' Admin', 'admin');
    
    res.json({
      success: true,
      message: 'Your church has been registered. An admin will activate your account shortly.',
      church: church_name
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = db.prepare(`
      SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.status as tenant_status
      FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.email = ?
    `).get(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    if (user.role !== 'super_admin' && user.tenant_status !== 'active') {
      return res.status(403).json({ error: 'Your church account is not yet activated. Please wait for approval.' });
    }
    
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        tenantName: user.tenant_name,
        tenantSlug: user.tenant_slug
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current user
app.get('/api/me', authMiddleware, (req, res) => {
  if (req.user.tenantId) {
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.user.tenantId);
    res.json({ ...req.user, tenant });
  } else {
    res.json({ ...req.user, tenant: null });
  }
});

// ============ TENANT MANAGEMENT (super-admin view) ============

// List all tenants (for approval)
app.get('/api/admin/tenants', authMiddleware, superAdminOnly, (req, res) => {
  const tenants = db.prepare('SELECT * FROM tenants ORDER BY created_at DESC').all();
  const counts = db.prepare(`
    SELECT t.id, COUNT(u.id) as staff_count
    FROM tenants t LEFT JOIN users u ON t.id = u.tenant_id
    GROUP BY t.id
  `).all();
  
  const countMap = {};
  counts.forEach(c => { countMap[c.id] = c.staff_count; });
  
  res.json(tenants.map(t => ({ ...t, staffCount: countMap[t.id] || 0 })));
});

// Approve a tenant
app.post('/api/admin/tenants/:id/approve', authMiddleware, superAdminOnly, (req, res) => {
  db.prepare('UPDATE tenants SET status = ? WHERE id = ?').run('active', req.params.id);
  res.json({ success: true, message: 'Church activated' });
});

// Deny/suspend
app.post('/api/admin/tenants/:id/suspend', authMiddleware, superAdminOnly, (req, res) => {
  db.prepare('UPDATE tenants SET status = ? WHERE id = ?').run('suspended', req.params.id);
  res.json({ success: true, message: 'Church suspended' });
});

// ============ STAFF MANAGEMENT ============

// Invite staff (admin only)
app.post('/api/staff/invite', authMiddleware, adminOnly, (req, res) => {
  try {
    const { email, name } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }
    
    const existing = db.prepare('SELECT id FROM users WHERE tenant_id = ? AND email = ?').get(tenantId, email);
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists in your church' });
    }
    
    // Generate a temp password and hash it
    const tempPassword = Math.random().toString(36).slice(-8);
    const hash = bcrypt.hashSync(tempPassword, 10);
    
    db.prepare(
      'INSERT INTO users (tenant_id, email, password_hash, name, role, invited_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(tenantId, email, hash, name, 'staff', req.user.userId);
    
    console.log(`[INVITE] ${name} <${email}> invited to tenant ${tenantId}. Temp password: ${tempPassword}`);
    
    res.json({
      success: true,
      message: `${name} has been invited as staff`,
      tempPassword // In production, send via email instead
    });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: 'Failed to invite staff' });
  }
});

// List staff for a tenant
app.get('/api/staff', authMiddleware, (req, res) => {
  const staff = db.prepare(
    'SELECT id, email, name, role, created_at FROM users WHERE tenant_id = ? ORDER BY created_at DESC'
  ).all(req.user.tenantId);
  res.json(staff);
});

// ============ FAMILY & CHILD MANAGEMENT ============

// Register a family
app.post('/api/families', authMiddleware, (req, res) => {
  try {
    const { parent_name, phone, email } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!parent_name) {
      return res.status(400).json({ error: 'Parent name is required' });
    }
    
    const result = db.prepare(
      'INSERT INTO families (tenant_id, parent_name, phone, email) VALUES (?, ?, ?, ?)'
    ).run(tenantId, parent_name, phone || '', email || '');
    
    res.json({
      id: result.lastInsertRowid,
      parent_name,
      phone,
      email,
      message: 'Family registered'
    });
  } catch (err) {
    console.error('Family create error:', err);
    res.status(500).json({ error: 'Failed to register family' });
  }
});

// List families
app.get('/api/families', authMiddleware, (req, res) => {
  const families = db.prepare(`
    SELECT f.*, GROUP_CONCAT(c.name || '|' || c.id || '|' || c.age) as children_list
    FROM families f
    LEFT JOIN children c ON c.family_id = f.id
    WHERE f.tenant_id = ?
    GROUP BY f.id
    ORDER BY f.parent_name ASC
  `).all(req.user.tenantId);
  
  const parsed = families.map(f => ({
    ...f,
    children: f.children_list ? f.children_list.split(',').map(child => {
      const [name, id, age] = child.split('|');
      return { id: parseInt(id), name, age };
    }) : []
  }));
  
  res.json(parsed);
});

// Add a child to a family
app.post('/api/children', authMiddleware, (req, res) => {
  try {
    const { family_id, name, age, allergies } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!family_id || !name) {
      return res.status(400).json({ error: 'Family ID and child name are required' });
    }
    
    // Verify family belongs to this tenant
    const family = db.prepare('SELECT id FROM families WHERE id = ? AND tenant_id = ?').get(family_id, tenantId);
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }
    
    const result = db.prepare(
      'INSERT INTO children (tenant_id, family_id, name, age, allergies) VALUES (?, ?, ?, ?, ?)'
    ).run(tenantId, family_id, name, age || '', allergies || '');
    
    res.json({
      id: result.lastInsertRowid,
      family_id,
      name,
      age,
      message: `${name} added to family`
    });
  } catch (err) {
    console.error('Child create error:', err);
    res.status(500).json({ error: 'Failed to add child' });
  }
});

// ============ CHECK-IN / CHECK-OUT ============

// Check in (with saved family/child records)
app.post('/api/checkin', authMiddleware, async (req, res) => {
  try {
    const { family_id, child_ids, room } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!family_id || !child_ids || child_ids.length === 0) {
      return res.status(400).json({ error: 'Family and at least one child are required' });
    }
    
    const family = db.prepare('SELECT * FROM families WHERE id = ? AND tenant_id = ?').get(family_id, tenantId);
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }
    
    const results = [];
    for (const childId of child_ids) {
      const child = db.prepare('SELECT * FROM children WHERE id = ? AND family_id = ?').get(childId, family_id);
      if (!child) continue;
      
      const code = generateCode(tenantId);
      
      db.prepare(`
        INSERT INTO checkins (tenant_id, family_id, child_id, parent_name, phone, kid_name, kid_age, room, code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(tenantId, family_id, childId, family.parent_name, family.phone, child.name, child.age, room || '', code);
      
      results.push({ childName: child.name, code });
    }
    
    // Send code via SMS if phone is on file
    if (family.phone && results.length > 0) {
      const codes = results.map(r => `${r.childName}: ${r.code}`).join('\n');
      sendSms(family.phone, `ShepherdCheck: ${results.length} child(ren) checked in.\n${codes}\n\nShow these codes at pickup.`);
    }
    
    res.json({
      success: true,
      familyName: family.parent_name,
      phone: family.phone,
      checkins: results,
      message: `${results.length} child(ren) checked in`
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// Quick check-in (no saved records — for guests)
app.post('/api/checkin/guest', authMiddleware, async (req, res) => {
  try {
    const { parent_name, phone, kid_name, kid_age, room } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!parent_name || !kid_name) {
      return res.status(400).json({ error: 'Parent name and kid name are required' });
    }
    
    const code = generateCode(tenantId);
    
    db.prepare(`
      INSERT INTO checkins (tenant_id, parent_name, phone, kid_name, kid_age, room, code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(tenantId, parent_name, phone || '', kid_name, kid_age || '', room || '', code);
    
    // Send code via SMS if phone provided
    if (phone) {
      sendSms(phone, `ShepherdCheck: ${kid_name} checked in. Pickup code: ${code}`);
    }
    
    res.json({
      success: true,
      code,
      parent_name,
      kid_name,
      message: `${kid_name} checked in! Code: ${code}`
    });
  } catch (err) {
    console.error('Guest check-in error:', err);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// Check out by code
app.post('/api/checkout', authMiddleware, (req, res) => {
  try {
    const { code } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }
    
    const checkin = db.prepare(
      'SELECT * FROM checkins WHERE tenant_id = ? AND code = ? AND checked_out_at IS NULL'
    ).get(tenantId, code);
    
    if (!checkin) {
      return res.status(404).json({ error: 'No active check-in found with that code' });
    }
    
    db.prepare('UPDATE checkins SET checked_out_at = CURRENT_TIMESTAMP WHERE id = ?').run(checkin.id);
    
    res.json({
      message: `${checkin.kid_name} checked out successfully`,
      kid_name: checkin.kid_name,
      parent_name: checkin.parent_name
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to check out' });
  }
});

// Get active check-ins for current tenant
app.get('/api/active', authMiddleware, (req, res) => {
  try {
    const active = db.prepare(`
      SELECT c.*, f.phone as family_phone
      FROM checkins c
      LEFT JOIN families f ON c.family_id = f.id
      WHERE c.tenant_id = ? AND c.checked_out_at IS NULL
      ORDER BY c.checked_in_at DESC
    `).all(req.user.tenantId);
    res.json(active);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch active check-ins' });
  }
});

// Dashboard stats
app.get('/api/stats', authMiddleware, (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    const totalToday = db.prepare(
      "SELECT COUNT(*) as count FROM checkins WHERE tenant_id = ? AND date(checked_in_at) = date('now')"
    ).get(tenantId);
    
    const activeNow = db.prepare(
      'SELECT COUNT(*) as count FROM checkins WHERE tenant_id = ? AND checked_out_at IS NULL'
    ).get(tenantId);
    
    const checkedOut = db.prepare(
      "SELECT COUNT(*) as count FROM checkins WHERE tenant_id = ? AND date(checked_in_at) = date('now') AND checked_out_at IS NOT NULL"
    ).get(tenantId);
    
    const familiesCount = db.prepare(
      'SELECT COUNT(*) as count FROM families WHERE tenant_id = ?'
    ).get(tenantId);
    
    res.json({
      totalToday: totalToday.count,
      activeNow: activeNow.count,
      checkedOut: checkedOut.count,
      familiesCount: familiesCount.count
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Text a parent (staff to parent message)
app.post('/api/text-parent', authMiddleware, async (req, res) => {
  try {
    const { checkin_id, message } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!checkin_id || !message) {
      return res.status(400).json({ error: 'Check-in ID and message are required' });
    }
    
    const checkin = db.prepare('SELECT * FROM checkins WHERE id = ? AND tenant_id = ?').get(checkin_id, tenantId);
    
    if (!checkin) {
      return res.status(404).json({ error: 'Check-in not found' });
    }
    
    const phone = checkin.phone || (checkin.family_id ? db.prepare('SELECT phone FROM families WHERE id = ?').get(checkin.family_id)?.phone : '');
    
    if (!phone) {
      return res.status(400).json({ error: 'No phone number on file for this parent' });
    }
    
    // Send SMS via sendSms helper
    await sendSms(phone, `ShepherdCheck: ${message}`);
    
    db.prepare('UPDATE checkins SET notes = notes || ? WHERE id = ?')
      .run(`\n[SMS sent to ${phone}]: ${message}`, checkin_id);
    
    res.json({ 
      success: true, 
      message: 'Message sent (logged — configure Twilio in production)' 
    });
  } catch (err) {
    console.error('Text parent error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Today's history
app.get('/api/history', authMiddleware, (req, res) => {
  try {
    const history = db.prepare(
      "SELECT * FROM checkins WHERE tenant_id = ? AND date(checked_in_at) = date('now') ORDER BY checked_in_at DESC"
    ).all(req.user.tenantId);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ============ SPA fallback ============

// For production: any non-API request serves the frontend
const frontendIndex = path.join(frontendPath, 'index.html');
if (fs.existsSync(frontendIndex)) {
  app.get('*', (req, res) => {
    res.sendFile(frontendIndex);
  });
}

// ============ Start ============

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🐑 ShepherdCheck running on http://0.0.0.0:${PORT}`);
  if (!process.env.JWT_SECRET) {
    console.log('⚠ Set JWT_SECRET environment variable in production');
  }
  console.log(`   Super admin: admin@shepherdcheck.com / admin123`);
  console.log(`   Demo church: demo@firstchurch.org / demo123\n`);
});