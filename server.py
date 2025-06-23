from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime
import os
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText

# Environment variables
load_dotenv()
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')  # Varsayılan değer eklendi
DB_NAME = 'fizyoterapi1'  # Veritabanı adını burada belirtiyoruz
EMAIL_USER = os.getenv('EMAIL_USER')
EMAIL_PASS = os.getenv('EMAIL_PASS')
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'elmali.medeniyetimu34@gmail.com')

app = Flask(__name__)
CORS(app)

# MongoDB connection with better error handling
try:
    client = MongoClient(MONGODB_URI, connectTimeoutMS=30000, socketTimeoutMS=30000)
    db = client[DB_NAME]
    appointments = db['appointments']
    contacts = db['contacts']
    
    # Test amaçlı bir insert yapıyoruz
    test_result = appointments.insert_one({'test': 'connection_test', 'timestamp': datetime.utcnow()})
    print(f"MongoDB bağlantısı başarılı! Test kaydı ID: {test_result.inserted_id}")
    
    # Test kaydını siliyoruz
    appointments.delete_one({'_id': test_result.inserted_id})
    
except Exception as e:
    print(f"MongoDB bağlantı hatası: {e}")
    print(f"Bağlantı URI: {MONGODB_URI}")
    exit(1)

# Email configuration
def send_email(subject, body, to_email):
    try:
        msg = MIMEText(body)
        msg['Subject'] = subject
        msg['From'] = EMAIL_USER
        msg['To'] = to_email
        
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(EMAIL_USER, EMAIL_PASS)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Email sending failed: {e}")
        return False

# API Routes
@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    try:
        # Get all appointments, sorted by date and time
        all_appointments = list(appointments.find({}, {'_id': 1, 'date': 1, 'time': 1, 'name': 1, 'phone': 1, 'email': 1, 'created_at': 1}))


        
        # Convert ObjectId to string for JSON serialization
        for appt in all_appointments:
            appt['id'] = str(appt['_id'])
            del appt['_id']
        
        return jsonify(all_appointments)
    except Exception as e:
        print(f"Error getting appointments: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/appointments', methods=['POST'])
def create_appointment():
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['date', 'time', 'name', 'email', 'phone']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        #aynı tarih ve saat randevu kontrolü
        existing_appointment = appointments.find_one({
            'date': data['date'],
            'time': data['time']
        })
        
        if existing_appointment:
            return jsonify({'error': 'Bu saat için zaten randevu bulunmaktadır'}), 400
        
        # Insert new appointment
        result = appointments.insert_one({
            'date': data['date'],
            'time': data['time'],
            'name': data['name'],
            'email': data['email'],
            'phone': data['phone'],
            'message': data.get('message', ''),
            'created_at': datetime.utcnow()
        })
        
        # Send confirmation email
        email_body = f"""
        Yeni Randevu Talebi:
        
        Tarih: {data['date']}
        Saat: {data['time']}
        Ad Soyad: {data['name']}
        Telefon: {data['phone']}
        E-posta: {data['email']}
        Mesaj: {data.get('message', 'Yok')}
        """
        
        send_email(
            "Yeni Randevu Talebi - Fizyoterapi",
            email_body,
            ADMIN_EMAIL
        )
        
        return jsonify({
            'success': True,
            'id': str(result.inserted_id)
        }), 201
    except Exception as e:
        print(f"Error creating appointment: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/appointments/<appointment_id>', methods=['DELETE'])
def delete_appointment(appointment_id):
    try:
        # Validate ObjectId
        if not ObjectId.is_valid(appointment_id):
            return jsonify({'error': 'Invalid appointment ID'}), 400
        
        # Delete appointment
        result = appointments.delete_one({'_id': ObjectId(appointment_id)})
        
        if result.deleted_count == 0:
            return jsonify({'error': 'Appointment not found'}), 404
        
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error deleting appointment: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/contact', methods=['POST'])
def contact_form():
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['name', 'email', 'message']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Save contact form
        contacts.insert_one({
            'name': data['name'],
            'email': data['email'],
            'phone': data.get('phone', ''),
            'message': data['message'],
            'created_at': datetime.utcnow()
        })
        
        # Send email notification
        email_body = f"""
        Yeni İletişim Formu:
        
        Ad Soyad: {data['name']}
        E-posta: {data['email']}
        Telefon: {data.get('phone', 'Yok')}
        Mesaj: {data['message']}
        """
        
        send_email(
            "Yeni İletişim Formu - Fizyoterapi",
            email_body,
            ADMIN_EMAIL
        )
        
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error processing contact form: {e}")
        return jsonify({'error': str(e)}), 500
    
#patch
@app.route('/api/appointments/<appointment_id>', methods=['PATCH'])
def update_appointment(appointment_id):
    try:
        # Validate ObjectId
        if not ObjectId.is_valid(appointment_id):
            return jsonify({'error': 'Invalid appointment ID'}), 400
        
        data = request.json
        
        # Validate required fields
        if 'time' not in data:
            return jsonify({'error': 'Time field is required'}), 400
        
        # Check if the new time is available
        existing_appointment = appointments.find_one({
            'date': data.get('date'),
            'time': data['time'],
            '_id': {'$ne': ObjectId(appointment_id)}  # Exclude current appointment
        })
        
        if existing_appointment:
            return jsonify({'error': 'Bu saat için zaten randevu bulunmaktadır'}), 400
        
        # Update appointment time
        result = appointments.update_one(
            {'_id': ObjectId(appointment_id)},
            {'$set': {'time': data['time']}}
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Appointment not found'}), 404
        
        # Get updated appointment to return
        updated_appointment = appointments.find_one({'_id': ObjectId(appointment_id)})
        updated_appointment['id'] = str(updated_appointment['_id'])
        del updated_appointment['_id']
        
        return jsonify(updated_appointment)
    except Exception as e:
        print(f"Error updating appointment: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=True)