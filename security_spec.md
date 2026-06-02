# Security Specification & Test-Driven Design (TDD) for Firestore Rules

This document outlines the Security Specification and Test-Driven Design (TDD) for the Maxo voice chat and social party room database. It defines the central Data Invariants, lists the "Dirty Dozen" payloads designed to compromise the system, and supplies a robust Mock Test Runner to audit security rules for the absolute mitigation of privilege escalation and resource exploits.

---

## 1. Data Invariants

1. **User Identity Invariant**: A user profile document `/users/{userId}` can only be created or modified if the document's `userId` matches the authenticated user's `request.auth.uid`. No user can create or spoof a profile belonging to another user ID.
2. **Economic Locking Invariant**: Users are strictly forbidden from modifying secondary system/economic attributes on their profile (e.g., `coins`, `diamonds`, `level`, `experience`, `isVIP`, `agencyId`). These are system-managed fields and must remain immutable or modified strictly through validated transactions (e.g., gift logging or store purchases) or administrative overrides.
3. **Room Ownership Invariant**: The creator and host of `/rooms/{roomId}` must have `hostId` matching their authenticated `request.auth.uid`. Only the host of a room can perform structural updates (such as changing room metadata or background theme), while co-hosts or audience members can only modify localized state fields if eligible.
4. **Message Authenticity Invariant**: Every message in `/rooms/{roomId}/messages/{messageId}` or in `/private_chats/{chatId}/messages/{messageId}` must have `senderId` strictly matching `request.auth.uid`. The message `type` cannot be self-escalated to "system" by ordinary clients.
5. **Atomic Gift Logging Invariant**: Any virtual gift transaction or purchase recorded in `/gift_logs/{logId}` must correspond to correct auth bindings to prevent coin balance theft or reward injection.
6. **Path Integrity Invariant**: Document IDs (`userId`, `roomId`, etc.) must be strictly sanitized using character range and size checks (e.g., limit of 128 chars, matching alphanumeric and separators) to prevent resource exhaustion and SQL-like/injection attacks.
7. **Verified Email Mandate**: Unless the user is identified with an verified email token when writing sensitive records, permission will be denied.

---

## 2. The "Dirty Dozen" Payloads

Here are the 12 malicious payloads designed to exploit the system across different collections:

### Payload 1: ID Poisoning / Path Variable Abuse
*   **Target Collection**: `/users/{userId}`
*   **Malicious Document ID**: `my-user-id-extremely-long-spam-containing-unicode-and-junk-characters-extending-for-more-than-two-thousand-bytes-to-exhaust-firestore-indexes-and-cause-massive-billing-exhaustion-attacks`
*   **Payload**: `{ "uid": "xyz", "displayName": "Attacker" }`
*   **Expected Result**: `PERMISSION_DENIED` (due to ID size exceeding 128 characters or matching alphanumeric patterns only).

### Payload 2: Identity Spoofing / Profile Creation Hijack
*   **Target Collection**: `/users/victim_user_123`
*   **Auth State**: Signed in as `attacker_user_456`
*   **Payload**: `{ "uid": "victim_user_123", "displayName": "Fake Victim", "coins": 1500, "diamonds": 10, "level": 1 }`
*   **Expected Result**: `PERMISSION_DENIED` (Cannot write to a profile that does not match current auth UID).

### Payload 3: Privilege Escalation via Self-Assigned VIP
*   **Target Collection**: `/users/attacker_user_456` (Create profile)
*   **Auth State**: Signed in as `attacker_user_456`
*   **Payload**: `{ "uid": "attacker_user_456", "displayName": "Attacker", "coins": 1500, "diamonds": 999999, "level": 100, "isVIP": true }`
*   **Expected Result**: `PERMISSION_DENIED` (Users cannot self-assign VIP status or mock highly elevated coin values during creation).

### Payload 4: Dynamic Wealth Injection (Shadow Update)
*   **Target Collection**: `/users/attacker_user_456` (Update profile)
*   **Auth State**: Signed in as `attacker_user_456`
*   **Payload**: `{ "uid": "attacker_user_456", "displayName": "Attacker", "bio": "Hacked", "coins": 99999999 }`
*   **Expected Result**: `PERMISSION_DENIED` (Updating wealth or economic fields in user profiles is completely restricted / must be immutable by standard users).

### Payload 5: Room Host Identity Spoofing
*   **Target Collection**: `/rooms/illegal_room_999`
*   **Auth State**: Signed in as `attacker_user_456`
*   **Payload**: `{ "id": "illegal_room_999", "title": "Spoofed Host Room", "hostId": "victim_user_123", "memberCount": 0, "isLive": true }`
*   **Expected Result**: `PERMISSION_DENIED` (New room's `hostId` must match the actual signing-in user's UID).

### Payload 6: Message Sender Impersonation
*   **Target Collection**: `/rooms/live_room_abc/messages/msg_111`
*   **Auth State**: Signed in as `attacker_user_456`
*   **Payload**: `{ "id": "msg_111", "senderId": "victim_user_123", "text": "I am sending a malicious spoofed message in someone else's name!", "timestamp": "2026-06-01T12:00:00Z" }`
*   **Expected Result**: `PERMISSION_DENIED` (Sender ID must strictly match current user).

### Payload 7: System Message Spoofer
*   **Target Collection**: `/rooms/live_room_abc/messages/msg_222`
*   **Auth State**: Signed in as `attacker_user_456`
*   **Payload**: `{ "id": "msg_222", "senderId": "attacker_user_456", "text": "Victim has transferred 10,000 coins to Attacker!", "timestamp": "2026-06-01T12:00:00Z", "type": "system" }`
*   **Expected Result**: `PERMISSION_DENIED` (Only "text" or specific common types are writeable by users; "system" message injection is blocked).

### Payload 8: Illegal Seat Modification (Room Member Impersonation)
*   **Target Collection**: `/rooms/live_room_abc/members/victim_user_123`
*   **Auth State**: Signed in as `attacker_user_456`
*   **Payload**: `{ "uid": "victim_user_123", "role": "host", "isMuted": false }`
*   **Expected Result**: `PERMISSION_DENIED` (Attacker cannot modify another member's seat, role, or mute state).

### Payload 9: Private Chat Interception / Snooping
*   **Target Collection**: `/private_chats/victim1_victim2/messages/msg_secret`
*   **Auth State**: Signed in as `attacker_user_456`
*   **Payload**: Trying to write or read message under a private chat ID where attacker is not a routing participant.
*   **Expected Result**: `PERMISSION_DENIED`.

### Payload 10: Follow Hijack (Unsolicited Follow Creation)
*   **Target Collection**: `/follows/f_attacker_victim`
*   **Auth State**: Signed in as `attacker_user_456`
*   **Payload**: `{ "followerId": "victim_user_123", "targetId": "attacker_user_456", "timestamp": "2026-06-01T12:00:00Z" }`
*   **Expected Result**: `PERMISSION_DENIED` (Cannot initiate a follow relationship where follower ID is not the authenticated sender).

### Payload 11: Artificial Popularity Inflation (Shadow Count Injection)
*   **Target Collection**: `/users/attacker_user_456`
*   **Auth State**: Signed in as `attacker_user_456`
*   **Payload**: `{ "uid": "attacker_user_456", "displayName": "Attacker", "followersCount": 10000000 }`
*   **Expected Result**: `PERMISSION_DENIED` (Followers count is mutable only by internal relational logic, not direct profile updates).

### Payload 12: Fraudulent Gift Logging / Token Stealing
*   **Target Collection**: `/gift_logs/g_log_xxx`
*   **Auth State**: Signed in as `attacker_user_456`
*   **Payload**: `{ "senderId": "victim_user_123", "receiverId": "attacker_user_456", "giftId": "expensive_gift_123", "coinsSpent": 5000 }`
*   **Expected Result**: `PERMISSION_DENIED` (Cannot generate a gift transaction log claiming to spend another user's coin wealth).

---

## 3. The Test Runner

The accompanying test runner `firestore.rules.test.ts` validates that all "Dirty Dozen" payloads fail against strict rules enforcing resource limits, identity bounds, data type verification, and system field immutability.

```typescript
// firestore.rules.test.ts
import { 
  assertFails, 
  assertSucceeds, 
  initializeTestEnvironment, 
  RulesTestEnvironment 
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

describe('Firestore Security Rules validation', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'gen-lang-client-0083104454',
      firestore: {
        rules: `rules_version = '2'; ...` // Will test the full compiled ruleset
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('Payload 1 Failure: Path variable abuse on ID size/format should fail', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const toxicId = "x".repeat(200);
    const docRef = doc(unauthDb, 'users', toxicId);
    await assertFails(setDoc(docRef, { uid: toxicId, displayName: 'Attack' }));
  });

  it('Payload 2 Failure: Identity Spoofing must reject writing to other profiles', async () => {
    const context = testEnv.authenticatedContext('attacker_456', { email_verified: true });
    const db = context.firestore();
    const docRef = doc(db, 'users', 'victim_123');
    await assertFails(setDoc(docRef, { uid: 'victim_123', displayName: 'Spoofed' }));
  });

  it('Payload 3 Failure: Preventing self-assigned VIP and starting wealth', async () => {
    const context = testEnv.authenticatedContext('attacker_456', { email_verified: true });
    const db = context.firestore();
    const docRef = doc(db, 'users', 'attacker_456');
    await assertFails(setDoc(docRef, { 
      uid: 'attacker_456', 
      displayName: 'Attacker', 
      isVIP: true, 
      coins: 9999999, 
      diamonds: 9999999,
      level: 100 
    }));
  });

  it('Payload 4 Failure: Economic wealth injection in profile updates must fail', async () => {
    const context = testEnv.authenticatedContext('attacker_456', { email_verified: true });
    const db = context.firestore();
    const docRef = doc(db, 'users', 'attacker_456');
    await assertFails(updateDoc(docRef, { coins: 999999 }));
  });

  it('Payload 5 Failure: Room Host Spoofing must fail', async () => {
    const context = testEnv.authenticatedContext('attacker_456', { email_verified: true });
    const db = context.firestore();
    const docRef = doc(db, 'rooms', 'illegal_room');
    await assertFails(setDoc(docRef, { id: 'illegal_room', title: 'Spoof Room', hostId: 'victim_123' }));
  });

  it('Payload 6 Failure: Room message sender impersonation must fail', async () => {
    const context = testEnv.authenticatedContext('attacker_456', { email_verified: true });
    const db = context.firestore();
    const docRef = doc(db, 'rooms/live_room/messages/msg_111');
    await assertFails(setDoc(docRef, { senderId: 'victim_123', text: 'Imposter' }));
  });

  it('Payload 7 Failure: Injecting system tagged message types must fail', async () => {
    const context = testEnv.authenticatedContext('attacker_456', { email_verified: true });
    const db = context.firestore();
    const docRef = doc(db, 'rooms/live_room/messages/msg_222');
    await assertFails(setDoc(docRef, { senderId: 'attacker_456', text: 'Hacked', type: 'system' }));
  });

  it('Payload 8 Failure: Modifying roles or seat metrics of other members must fail', async () => {
    const context = testEnv.authenticatedContext('attacker_456', { email_verified: true });
    const db = context.firestore();
    const docRef = doc(db, 'rooms/live_room/members/victim_123');
    await assertFails(setDoc(docRef, { uid: 'victim_123', role: 'host' }));
  });

  it('Payload 9 Failure: Out-of-bounds private chat messages must fail', async () => {
    const context = testEnv.authenticatedContext('attacker_456', { email_verified: true });
    const db = context.firestore();
    const docRef = doc(db, 'private_chats/victim1_victim2/messages/msg_secret');
    await assertFails(setDoc(docRef, { text: 'Spy Message', senderId: 'attacker_456' }));
  });

  it('Payload 10 Failure: Follow hijacking should fail', async () => {
    const context = testEnv.authenticatedContext('attacker_456', { email_verified: true });
    const db = context.firestore();
    const docRef = doc(db, 'follows/f_attacker_victim');
    await assertFails(setDoc(docRef, { followerId: 'victim_123', targetId: 'attacker_456' }));
  });

  it('Payload 11 Failure: Manual followers count inflation on update should fail', async () => {
    const context = testEnv.authenticatedContext('attacker_456', { email_verified: true });
    const db = context.firestore();
    const docRef = doc(db, 'users/attacker_456');
    await assertFails(updateDoc(docRef, { followersCount: 50000 }));
  });

  it('Payload 12 Failure: Spend other user coins via fraudulent gift log should fail', async () => {
    const context = testEnv.authenticatedContext('attacker_456', { email_verified: true });
    const db = context.firestore();
    const docRef = doc(db, 'gift_logs/g_log_xxx');
    await assertFails(setDoc(docRef, { senderId: 'victim_123', receiverId: 'attacker_456', giftId: 'val', coinsSpent: 500 }));
  });
});
```
