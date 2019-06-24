import requests
import json


def main():
    batch = json.dumps([json.dumps({
                      "jsonrpc": "2.0", "method": "add", "params": [1, 2]}), json.dumps({
                          "jsonrpc": "2.0", "method": "add", "params": [1, 5], "id": 1})])
    batch_res = requests.post('http://127.0.0.1:8200', data=batch,
                      headers={'content-type': 'application/json'})
    delim = json.dumps({
                      "jsonrpc": "2.0", "method": "add", "params": [1, 2]}) +"\r\n" + json.dumps({
                          "jsonrpc": "2.0", "method": "add", "params": [1, 5], "id": 1}) + "\r\n"
    delim_res = requests.post('http://127.0.0.1:8200', data=delim,
                      headers={'content-type': 'application/json'})

    print batch_res.text
    print delim_res.text


if __name__ == '__main__':
    main()
