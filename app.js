//Dependencies
const express = require("express");
const mysql = require("mysql");
const path    = require("path");
const bp = require("body-parser");
const app = express();

var urlbp = bp.urlencoded({ extended: false });
var selected = 0;
var filter = 0;
var sort_item = "item_name";

//View Engine
app.set('view engine', 'ejs');
app.use(express.static('public'));

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

//Routes
app.get("/",(req,res) => {
        let sql = "SELECT * FROM " + tables[selected];
        db.query(sql, (err,datares) =>{
            if(err) 
                console.log(err);
            else{
                    res.render('home',{tables: tables, data: datares});
                }
            });
});

app.post("/selection",urlbp, (req,res) => {
    selected = parseInt(req.body.selection);
    backURL=req.header('Referer') || '/';
    res.redirect(backURL);
});

app.post("/new",urlbp, (req,res) =>{
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

app.post("/order",urlbp, (req,res) => {
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


