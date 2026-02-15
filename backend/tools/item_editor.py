import tkinter as tk
from tkinter import messagebox
import json
import os

# Define path to items.json located in ../app/data/items.json relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, '..', 'app', 'data', 'items.json')

class ItemEditorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Items.json Editor")
        self.root.geometry("600x600")

        # Variables
        self.next_id_var = tk.StringVar()
        self.title_var = tk.StringVar()
        self.image_var = tk.StringVar()
        self.public_tags_var = tk.StringVar()
        self.hidden_tags_var = tk.StringVar()

        # UI Layout
        self.create_widgets()
        
        # Load ID
        self.load_next_id()

    def create_widgets(self):
        # ID Display
        tk.Label(self.root, text="Next ID:").pack(pady=5)
        self.id_label = tk.Label(self.root, textvariable=self.next_id_var, font=("Arial", 14, "bold"))
        self.id_label.pack()

        # Title
        tk.Label(self.root, text="Title:").pack(pady=5)
        tk.Entry(self.root, textvariable=self.title_var, width=50).pack()

        # Text (TextArea)
        tk.Label(self.root, text="Text Description:").pack(pady=5)
        self.text_area = tk.Text(self.root, height=5, width=50)
        self.text_area.pack()

        # Image URL
        tk.Label(self.root, text="Image URL:").pack(pady=5)
        tk.Entry(self.root, textvariable=self.image_var, width=50).pack()

        # Public Tags
        tk.Label(self.root, text="Public Tags (comma separated):").pack(pady=5)
        tk.Entry(self.root, textvariable=self.public_tags_var, width=50).pack()

        # Hidden Tags
        tk.Label(self.root, text="Hidden Tags (comma separated):").pack(pady=5)
        tk.Entry(self.root, textvariable=self.hidden_tags_var, width=50).pack()

        # Save Button
        tk.Button(self.root, text="Save Item", command=self.save_item, bg="#4CAF50", fg="white", font=("Arial", 12)).pack(pady=20)
        
        # Status Bar
        self.status = tk.Label(self.root, text="Ready", bd=1, relief=tk.SUNKEN, anchor=tk.W)
        self.status.pack(side=tk.BOTTOM, fill=tk.X)

    def load_data(self):
        if not os.path.exists(DATA_FILE):
            return []
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            messagebox.showerror("Error", "Invalid JSON file!")
            return []

    def load_next_id(self):
        data = self.load_data()
        if not data:
            next_id = 1
        else:
            ids = [item.get('id', 0) for item in data]
            next_id = max(ids) + 1 if ids else 1
        
        self.next_id_var.set(str(next_id))
        return next_id

    def save_item(self):
        # Validation
        title = self.title_var.get().strip()
        text_content = self.text_area.get("1.0", tk.END).strip()
        image = self.image_var.get().strip()
        
        if not title:
            messagebox.showwarning("Validation", "Title is required!")
            return

        # Prepare Data
        new_id = int(self.next_id_var.get())
        
        public_tags = [tag.strip() for tag in self.public_tags_var.get().split(',') if tag.strip()]
        hidden_tags = [tag.strip() for tag in self.hidden_tags_var.get().split(',') if tag.strip()]

        new_item = {
            "id": new_id,
            "title": title,
            "text": text_content,
            "image": image,
            "public_tags": public_tags,
            "hidden_tags": hidden_tags
        }

        # Save to File
        data = self.load_data()
        data.append(new_item)

        try:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            messagebox.showinfo("Success", f"Item ID {new_id} saved successfully!")
            self.clear_form()
            self.load_next_id()
            self.status.config(text=f"Last saved: ID {new_id}")

        except Exception as e:
            messagebox.showerror("Error", f"Failed to save file: {e}")

    def clear_form(self):
        self.title_var.set("")
        self.text_area.delete("1.0", tk.END)
        self.image_var.set("")
        self.public_tags_var.set("")
        self.hidden_tags_var.set("")

if __name__ == "__main__":
    root = tk.Tk()
    app = ItemEditorApp(root)
    root.mainloop()
