//Dependencies ADD CRYPTO+JWT
const express = require("express");
const mysql = require("mysql");
const path    = require("path");
const bp = require("body-parser");
const flash = require("express-flash");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const app = express();

//Variables
var selected = 0;
var filter = 0;
var sort_item = "item_name";

//View Engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bp.urlencoded({extended:false}));
app.use(bp.json());
app.use(session({secret: 'keyboard cat',
                saveUninitialized: true,
                resave: 'true'}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

//SQL Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    database: "prototype"
});

db.connect((err) => {
    if(err){
        console.log("Cannot connect MySQL");
        console.log(err);
    }else{
        console.log("MySQL Connected !");
    }
});

var tables = [];
db.query("SHOW TABLES", (err,results) => {
    for(i in results){
        tables = tables.concat(Object.values( results[i] ) );
    }
});

var brands = {};
db.query("SELECT * FROM brand", (err,results) => {
    brands = results;
});

//Passport.js

app.use(function(req,res,next){
res.locals.loginFlash = req.flash('loginMessage',"Test Flash");
next();
});

  // used to serialize the user for the session
  passport.serializeUser(function(user, done) {
    done(null, user.customer_id);
});

// used to deserialize the user
passport.deserializeUser(function(customer_id, done) {
    let sql = "select * from customer where customer_id = ?"
    db.query(sql,customer_id, function(err,rows){
        console.log("test: "+rows);
        done(err, rows[0]);
    });
});


passport.use(new LocalStrategy({
    usernameField: 'user',
    passwordField: 'password',
    passReqToCallback: true
    },
    function(req,user,password,done){
    let sql = "SELECT * FROM `customer` WHERE `cuser` = '" + user + "'";
    db.query(sql,function(err,rows){
        if (err)
            return done(err);
         if (!rows.length) {
            return done(null, false, req.flash('loginMessage',"No user found.") ); // req.flash is the way to set flashdata using connect-flash
        } 
        
        // if the user is found but the password is wrong
        if (!( rows[0].cpass == password))
            return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.')); // create the loginMessage and save it to session as flashdata
        
        // all is well, return successful user
        return done(null, rows[0]);			
    });
}));
//Routes
app.get("/",(req,res) => {
    if(req.user)
    res.render("home", {auth: req.user});
    else
    res.render("login");
});

app.get("/admin",(req,res) => {
    let sql = "SELECT * FROM " + tables[selected];
    db.query(sql, (err,datares) =>{
        if(err) 
            console.log(err);
        else{
                res.render('admin',{tables: tables, data: datares});
            }
        });
});

app.post("/login", passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/error',
    failureFlash: true })
);

app.post("/selection", (req,res) => {
    selected = parseInt(req.body.selection);
    backURL=req.header('Referer') || '/';
    res.redirect(backURL);
});

app.post("/new", (req,res) =>{
    let sql = "INSERT INTO "+ tables[selected] +" SET ?";
    let query = db.query(sql,req.body, (err,result) => {
            if(err) console.log( err);
            else {
                res.redirect("/");
            }
        });
});


app.get("/order", (req,res)=>{
    let sql = 0;
    if(filter == 0){
        sql = "SELECT * FROM item ORDER BY " + sort_item;

    }
    else{
        sql = "SELECT * FROM item " + "WHERE brand_id = " + filter + " ORDER BY " + sort_item;
    }
        db.query(sql, (err,result) =>{
            if(err) console.log(err);
            else{
                res.render("items",{result: result, brand: brands});
            }
        }); 

});

app.post("/order", (req,res) => {
        filter = (req.body.filter==null) ? 0 : req.body.filter
        sort_item = (req.body.sort==null) ? "item_name" : req.body.sort
    backURL=req.header('Referer') || '/';
    res.redirect(backURL);
});

// app.get("/order", (req,res) => {
//     let sql2 = "DESCRIBE " + tables[selected];
//     db.query(sql2,(err,desc) => {
//         console.log(desc);
//         var cols = [];
//        for( i in desc){
//             cols = cols.concat(Object.values(desc[i])[0]);
//         };
//         res.render('order',{tables:tables, cols: cols});
//     });
// });

app.listen("3000",() => {
    console.log("Listening on port 3000");
});


