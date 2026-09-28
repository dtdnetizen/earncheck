"""Run with python work/nano-offer-gate/schema_test.py; uses memory only."""
import pathlib
import sqlite3
import tempfile
from concurrent.futures import ThreadPoolExecutor

db = sqlite3.connect(':memory:')
db.executescript(pathlib.Path(__file__).with_name('schema.sql').read_text())
id = 'A' * 64
db.execute("INSERT INTO payment_intents(payment_id,request_digest,amount_raw,purpose,recovery_secret_sha256,confirmed) VALUES (?,?,?,?,?,1)",
           (id, 'b' * 64, '10000000000000000000000000000000', 'prepay', 'c' * 64))
db.execute("INSERT INTO prepaid_packages(payment_id,token_sha256,recovery_secret_sha256,total_calls,remaining_calls) VALUES (?,?,?,?,?)",
           (id, 'd' * 64, 'c' * 64, 1000, 1000))
sql = """INSERT INTO prepaid_reports(package_payment_id,idempotency_key,request_digest,response_json)
 SELECT ?,?,?,? WHERE NOT EXISTS
 (SELECT 1 FROM prepaid_reports WHERE package_payment_id=? AND idempotency_key=?)
 ON CONFLICT(package_payment_id,idempotency_key) DO NOTHING"""
def spend(key, digest='e' * 64):
    db.execute(sql, (id, key, digest, '{}', id, key))
    return db.execute('SELECT remaining_calls FROM prepaid_packages WHERE payment_id=?', (id,)).fetchone()[0]

assert spend('first-key-0000001') == 999
assert spend('first-key-0000001') == 999  # replay cannot debit twice
for n in range(999):
    spend(f'call-{n:016d}')
assert db.execute('SELECT remaining_calls FROM prepaid_packages').fetchone()[0] == 0
assert db.execute('SELECT count(*) FROM prepaid_reports').fetchone()[0] == 1000
try:
    spend('exhausted-0000001')
except sqlite3.IntegrityError as error:
    assert 'credits_exhausted' in str(error)
else:
    raise AssertionError('an exhausted package accepted another call')
assert spend('first-key-0000001') == 0  # even exhausted, prior result can replay
print('schema_and_1000_call_debit_ok')

# Two writers submit the same idempotency key on separate connections. SQLite
# serializes the write statements; only one new row and debit should appear.
with tempfile.TemporaryDirectory() as directory:
    path = pathlib.Path(directory) / 'shared.sqlite'
    first = sqlite3.connect(path)
    first.executescript(pathlib.Path(__file__).with_name('schema.sql').read_text())
    first.execute("INSERT INTO payment_intents(payment_id,request_digest,amount_raw,purpose,recovery_secret_sha256,confirmed) VALUES (?,?,?,?,?,1)",
                  (id, 'b' * 64, '10000000000000000000000000000000', 'prepay', 'c' * 64))
    first.execute("INSERT INTO prepaid_packages(payment_id,token_sha256,recovery_secret_sha256,total_calls,remaining_calls) VALUES (?,?,?,?,?)",
                  (id, 'd' * 64, 'c' * 64, 1000, 1000))
    first.commit()
    first.close()
    def concurrent_spend(_):
        connection = sqlite3.connect(path, timeout=5)
        connection.execute(sql, (id, 'same-key-00000001', 'e' * 64, '{}', id, 'same-key-00000001'))
        connection.commit()
        connection.close()
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(concurrent_spend, range(2)))
    check = sqlite3.connect(path)
    assert check.execute('SELECT remaining_calls FROM prepaid_packages').fetchone()[0] == 999
    assert check.execute('SELECT count(*) FROM prepaid_reports').fetchone()[0] == 1
    check.close()
print('concurrent_same_key_single_debit_ok')
