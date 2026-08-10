import sys
import os
import g4f

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from g4f.client import Client

client = Client()

text = "Summarize this in JSON: { 'test': 'hello' }"

print("Testing Blackbox...")
try:
    response = client.chat.completions.create(
        model="gpt-4o",
        provider=g4f.Provider.Blackbox,
        messages=[{"role": "user", "content": text}]
    )
    print("Blackbox Success:", response.choices[0].message.content)
except Exception as e:
    print("Blackbox failed:", e)
