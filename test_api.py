import urllib.request
import json

# Test hospitals endpoint
data = json.loads(urllib.request.urlopen('http://localhost:8000/hospitals/').read())
print(f'Hospitals: {len(data)}')
for h in data:
    print(f'  - {h["name"]} (id={h["id"]})')

# Test qr-data endpoint
qr_data = json.loads(urllib.request.urlopen('http://localhost:8000/hospitals/qr-data').read())
print(f'\nQR Data Hospitals: {len(qr_data)}')
total_docs = 0
for h in qr_data:
    print(f'  {h["name"]}: {len(h["doctors"])} doctors')
    total_docs += len(h["doctors"])
print(f'Total doctors: {total_docs}')

# Test scan-validate endpoint
import urllib.parse
qr_payload = json.dumps({
    "type": "hospital_qr",
    "doctor_id": "doc-101",
    "hospital_id": "h1",
    "department": "Sonography",
    "hospital_name": "Bombay Hospital Indore",
    "doctor_name": "Dr. Clara Oswald"
})
req = urllib.request.Request(
    'http://localhost:8000/tokens/scan-validate',
    data=json.dumps({"qr_data": qr_payload}).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)
resp = json.loads(urllib.request.urlopen(req).read())
print(f'\nScan-Validate Test:')
print(f'  Valid: {resp["valid"]}')
print(f'  Doctor: {resp["doctor"]["name"]}')
print(f'  Hospital: {resp["hospital"]["name"]}')
print(f'  Queue ahead: {resp["queue"]["patients_ahead"]}')
print(f'  ETA minutes: {resp["queue"]["eta_minutes"]}')

# Test QR image generation
qr_img = urllib.request.urlopen('http://localhost:8000/tokens/qr/doc-101')
content_type = qr_img.headers.get('content-type')
img_size = len(qr_img.read())
print(f'\nQR Image for doc-101:')
print(f'  Content-Type: {content_type}')
print(f'  Size: {img_size} bytes')
print('\nAll backend tests PASSED!')
