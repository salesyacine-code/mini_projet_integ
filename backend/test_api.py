import urllib.request
import json

def test_gav():
    try:
        res = urllib.request.urlopen('http://127.0.0.1:8000/auteurs')
        data = json.loads(res.read())
        print("GAV Total Auteurs:", data.get('total'))
    except Exception as e:
        print("GAV Error:", e)

def test_lav():
    try:
        req = urllib.request.Request(
            'http://127.0.0.1:8000/lav/query',
            data=json.dumps({'entity': 'AUTEUR'}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        res = urllib.request.urlopen(req)
        data = json.loads(res.read())
        print("LAV Total Auteurs:", data.get('total'))
    except Exception as e:
        print("LAV Error:", e)

def test_crud():
    try:
        # Create
        post_req = urllib.request.Request(
            'http://127.0.0.1:8000/auteurs?source=S1',
            data=json.dumps({"auteur_id": "A999", "nom": "Test", "prenom": "User"}).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        urllib.request.urlopen(post_req)
        print("CRUD: Created successfully")
        
        # Read (from GAV)
        res = urllib.request.urlopen('http://127.0.0.1:8000/auteurs')
        data = json.loads(res.read())
        found = any(a.get("auteur_id") == "A999" for a in data.get("data", []))
        print("CRUD: Read verified:", found)
        
        # Delete
        del_req = urllib.request.Request(
            'http://127.0.0.1:8000/auteurs/A999?source=S1',
            method='DELETE'
        )
        urllib.request.urlopen(del_req)
        print("CRUD: Deleted successfully")
        
    except Exception as e:
        print("CRUD Error:", e)

if __name__ == "__main__":
    test_gav()
    test_lav()
    test_crud()
