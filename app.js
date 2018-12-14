//Dependencies ADD CRYPTO+JWT
const express = require("express");
const mysql = require("mysql");
const path    = require("path");
const bp = require("body-parser");
const flash = require("req-flash");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const validator = require("express-validator");
const app = express();

//View Engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bp.urlencoded({extended:false}));
app.use(bp.json());
app.use(session({secret: 'keyboard cat',
                saveUninitialized: true,
                resave: 'true',
                expires: new Date(Date.now() + 1800000)}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash({locals: 'flash'}));
app.use(validator());


app.use( (req,res,next) => {
    if(!req.session.cart) {
    req.session.cart = {
        items: [],
        totals: 0.00,
    }}
    if(!req.session.selected )
    req.session.selected = 0;
    
    if(!req.session.filter)
    req.session.filter = 0;
    
    if(!req.session.sort_item )
    req.session.sort_item = "item_name";

    req.session.cookie.expires = new Date(Date.now() + 150000);
    next();
});
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


//Passport.js
// app.use(function(req,res,next){
//     res.locals.regsucc = req.flash('regsucc');
//     res.locals.regfail = req.flash('reqfail');
//     res.locals.login = req.flash('login');
//     res.locals.qty = req.flash('invalid_qty');
//     res.locals.cart_error = req.flash('cart_error');
// next();
// });
  // used to serialize the user for the session
  passport.serializeUser(function(user, done) {
    done(null, user.customer_id);
});

// used to deserialize the user
passport.deserializeUser(function(customer_id, done) {
    let sql = "select * from customer where customer_id = ?"
    db.query(sql,customer_id, function(err,rows){
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

//--------------------------------------Routes----------------------------------------
//Post-Routes

app.post("/login", passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/',
    failureFlash: true })
);

app.post("/register", (req,res) => {
    var customer_id = null,
        cuser = req.body.cuser;
        cpass = req.body.cpass;
        email = req.body.email;
        ship_addr = req.body.ship_addr;
        phone = req.body.phone;

        req.checkBody("cuser","Username is required").notEmpty();
        req.checkBody("cpass","Password is required").notEmpty();
        req.checkBody("email","E-mail is required").notEmpty();
        req.checkBody("email","E-mail is invalid").isEmail();
        req.checkBody("ship_addr","Shipping address is required").notEmpty();
        req.checkBody("phone","Buissness phone is required").notEmpty();
        
        // ship_addr = ship_addr.replace(",","/,");

        var errors = req.validationErrors();
        if(errors)
         res.render("register",{errors:errors});
         else
         {
            let data = {customer_id,cuser,cpass,email,ship_addr,phone};
            console.log(data);
            let sql = "insert into customer set ?"
            db.query(sql,[data],(err,result)=>{
                if(err){
                    console.log(err);
                    console.log("fail");
                    req.flash("regfail","Username in use");
                }
                else
                {
                    console.log("succ");
                    req.flash("regsucc","Registration Succesfull :)");
                }
                console.log()
                res.render("register",{flash: res.locals.flash});
            }); 
         }
});

app.post("/editprofile",(req,res)=>{
    var cuser = req.body.cuser;
        email = req.body.email;
        ship_addr = req.body.ship_addr;
        phone = req.body.phone;
        bank = req.body.bank;

        req.checkBody("cuser","Username is required").notEmpty();
        req.checkBody("email","E-mail is required").notEmpty();
        req.checkBody("email","E-mail is invalid").isEmail();
        req.checkBody("ship_addr","Shipping address is required").notEmpty();
        req.checkBody("phone","Buissness phone is required").notEmpty();

        var errors = req.validationErrors();
        if(errors)
         res.render("dash",{auth:req.user,errors:errors});
         else
         {
            let data = {cuser,email,ship_addr,phone,bank};
            let sql = "update customer set ? where customer_id = " + req.user.customer_id;
             db.query(sql,data,(err,result) =>{
                if(err) console.log(err);
                else
                {
                    req.flash("succ","Updated :)");
                    res.redirect("dash");
                }
             });
         }
});

app.post("/selection", (req,res) => {
    req.session.selected = parseInt(req.body.selection);
    backURL=req.header('Referer') || '/';
    res.redirect(backURL);
});

app.post("/new", (req,res) =>{
        var tables = [];
        db.query("SHOW TABLES", (err,results) => {
        for(i in results){
            tables = tables.concat(Object.values( results[i] ) );
        }
        let sql = "INSERT INTO "+ tables[req.session.selected] +" SET ?";
        db.query(sql,req.body, (err,result) => {
                if(err) console.log( err);
                else {
                    res.redirect("/");
                }
            });
        });
});

app.post("/order", (req,res)=>{
    let item_id = parseInt(req.body.item_id);
    let qty = parseInt(req.body.qty);
    // let price = parseInt(req.body.price);
    let av_qty = parseInt(req.body.av_qty);
    let found = req.session.cart.items.find(x => x.item_id == item_id);
    req.session.invalid_id = 0;

    if(typeof found != "undefined"){
        req.session.invalid_id = item_id;
        req.flash("cart_error","Item already In cart");
        res.redirect("/order");
    } 
    else if(qty == 0 || qty > av_qty)
    {
        req.session.invalid_id = item_id;
        req.flash("cart_error","Invalid quantity");
        res.redirect("/order");
    }
    else
    {
        req.session.invalid_id = 0;
        // subtotal = price*qty;
        let sql = "select * from item where item_id = " + item_id;
        db.query(sql,(err,result) =>{
            result = result[0];
            result.qty = qty;
            result.subtotal = result.price * qty;
            req.session.cart.items.push(result);
            req.session.cart.totals += result.subtotal;
            res.redirect("/order");
        });
    }
});

app.post("/pass_para", (req,res) => {
    req.session.filter = (req.body.filter==null) ? 0 : req.body.filter
    req.session.sort_item = (req.body.sort==null) ? "item_name" : req.body.sort
    backURL=req.header('Referer') || '/';
    res.redirect(backURL);
});

app.post("/cart", (req,res) =>{
    if(!req.user){
        req.flash("login","Please login to procceed");
        res.redirect("/cart");
    }
    else
    {   
        db.beginTransaction( (err) => {
            if(err) {console.log(err);}
            //Definding a package
            let sql = "insert into package(price,ship_adr) values ("+req.session.cart.totals+", '"+req.user.ship_addr+"')";
            db.query(sql, (err,result1) =>{
                if(err) db.rollback(()=>{console.log(err);});
                else{
                    if(req.session.cart.totals > req.user.bank){
                        req.flash("money","Insufficent Credit");
                        db.rollback(()=>{console.log(err);});
                    }
                    //Definding a package_order(package_id,item_id,qty,subtotal)
                        //making object
                        let items = req.session.cart.items;
                        let another_items = req.session.cart.items;

                        another_items.forEach( (item)=>{
                            item.av_quantity = item.av_quantity - item.qty;
                            db.query("update item set av_quantity = " + item.av_quantity + " where item_id = " + item.item_id,
                            (err,result)=>{
                                if(err) db.rollback(()=>{console.log(err);});
                            });
                        });

                        items.forEach(item =>{
                                item.package_id = result1.insertId;
                                delete item.item_name;
                                delete item.brand_id;
                                delete item.av_quantity;
                                delete item.img_path;
                            });
                        console.log(another_items);
                        let toInsert = [];
                        for(let i in items){
                            let innerArr = [];
                            for(let y in items[i]){
                                innerArr.push(items[i][y]);    
                            }
                            toInsert.push(innerArr);
                        }
                        
                            sql = "insert into package_order (item_id,price,qty,subtotal,package_id) values ?"
                            db.query(sql,[toInsert], (err,result2) =>{
                                if(err) db.rollback(()=>{console.log(err);});
                                else
                                {
                                    //Define Customer Order
                                    sql = "insert into customer_order(customer_id,package_id) values (" + req.user.customer_id + "," + result1.insertId + ")"; 
                                    db.query(sql,(err,result3)=>{
                                        if(err) db.rollback(()=>{console.log(err);});
                                        else
                                        {
                                            console.log("added package " +result1.insertId);
                                            db.query("update customer set bank = "+ (req.user.bank - req.session.cart.totals) + " where customer_id = "+ req.user.customer_id,
                                            (err,result4)=>{ if(err) db.rollback(()=>{console.log(err);});
                                            });
                                                    db.commit((err)=>{
                                                        if(err) db.rollback(()=>{console.log(err);});
                                                        else{
                                                        req.flash("succ","Transaction Complete :)");
                                                        delete req.session.cart;
                                                        res.redirect("/cart");
                                                        }
                                            });
                                        }
                                    });
                                }
                            });
                }
            });
        });
    }
});

app.post("/driver",(req,res)=>{
    let package_id = req.body.packid;
    let sql = "select * from customer_order co,customer c where co.package_id = "+package_id+  " and co.customer_id = c.customer_id"
    db.query(sql,(err,result)=>{
        if(err) console.log(err)
        else
        {
            console.log(result);
            //deliver(id,customer_id,to_addr,esitmated,phone,package_id)
            db.query("select * from driver where available = 1" ,(err,driver)=>{
                if(driver[0]){
                    sql = "insert into deliver(customer_id,to_addr,phone,package_id,driver_id) values("+
                        result[0].customer_id+",'"+result[0].ship_addr+"','"+result[0].phone+"',"+result[0].package_id+","+driver[0].staff_id+")";
                    db.query(sql,(err,result2)=>{
                        if(err) {console.log(err); throw err;}
                        else
                        {
                            sql = "update package set shipped = 1 where package_id = "+package_id;
                            db.query(sql,(err,result3,next)=>{
                                if(err) console.log(err)
                                else{
                                }
                            });  
                            sql = "update driver set available = 0 where staff_id = "+ driver[0].staff_id;
                            db.query(sql,(err,result4,next)=>{
                                if(err) console.log(err)
                                else{
                                res.redirect("/driver");
                                }
                            });                          
                        }
                    });
                    }
                    else
                    {
                        req.flash("driver","No driver available");
                        res.redirect("/driver");
                    }
                });
        }
    });
});

//Get-Routes
app.get("/",(req,res) => {
    if(req.user)
    res.render("dash", {auth: req.user});
    else
    res.render("login");
});

app.get("/logout", (req,res) =>{
    req.logout();
    res.redirect("/");
});

app.get("/dash", (req,res)=>{
    res.render("dash",{auth: req.user,flash: res.locals.flash});
});

app.get("/support",(req,res)=>{
    res.render("support");
});

app.get("/report",(req,res)=>{
    if(req.user.access <= 2){
        res.send("Error 404: Cannot find page");
    }
    else{
            db.query("select item_id,item_name from item",(err,result)=>{
                if(err) console.log(err)
                else
                res.render("report",{auth: req.user, items: result});
            });
        }
});

app.get("/curr_orders",(req,res)=>{
    let sql="select *,DATE_ADD(order_date, INTERVAL 3 DAY) as estimated_date from deliver d,customer_order co where d.customer_id = co.customer_id and co.customer_id = "+req.user.customer_id;
    db.query(sql,(err,result)=>{
        if(err) console.log(err);
        else
        {
            res.render("curr_orders",{auth: req.user,orders: result});
        }
    });
});

app.post("/report",(req,res)=>{
            let item_id = req.body.item_id;
            let sql1 = "select * from customer c,item i,package_order po,package p,customer_order co where i.item_id = po.item_id and p.package_id = po.package_id and c.customer_id = co.customer_id and co.package_id = po.package_id";
            let sql2 = "select avg(subtotal) as avg_sales, sum(qty) as total_sales from package_order";
            let sql3 = "select item_id,item_name from item";
            if(item_id > 0)
            {
                sql1 = "select * from customer c,item i,package_order po,package p,customer_order co where i.item_id = po.item_id and p.package_id = po.package_id and c.customer_id = co.customer_id and co.package_id = po.package_id and i.item_id = "+item_id;
                sql2 = "select avg(subtotal) as avg_sales, sum(qty) as total_sales from package_order where item_id = " + item_id;
            }
            db.query(sql1,(err,item_stats)=>{
                if(err) console.log(err);
                else
                {
                    db.query(sql2,(err,meta)=>{
                        if(err) console.log(err);
                        else
                        {
                            db.query(sql3, (err,items)=>{
                                if(err) console.log(err);
                                else
                                res.render("report", {auth: req.user, meta: meta[0], orders: item_stats, items: items});
                            })
                        }
                    });

                }
            });
});

app.get("/sales",(req,res)=>{
    let sql = "select *,date_format(order_date, '%Y %D %M %h:%i:%s') as formated from customer_order c, package_order po,package p, item i where customer_id = " +
     req.user.customer_id +" and c.package_id = po.package_id and p.package_id = po.package_id and po.item_id = i.item_id order by po.package_id";
    db.query(sql,(err,result)=>{
        res.render("sales", {auth: req.user,orders: result});
    });
});

app.get("/driver",(req,res)=>{
    db.query("select * from package where shipped = 0 order by package_id,ship_adr", (err,result)=>{
        res.render("driver", {auth: req.user, packs: result});
    });
});

app.get("/admin",(req,res) => {
        var tables = [];
        let query = db.query("SHOW TABLES", (err,results) => {
        for(i in results){
            tables = tables.concat(Object.values( results[i] ) );
        }
        let sql = "SELECT * FROM " + tables[req.session.selected];
        db.query(sql, (err,datares) =>{
            if(err) 
                console.log(err);
            else{
                    res.render('admin',{auth: req.user, tables: tables, data: datares});
                }
            });
        });
});

app.get("/register", (req,res)=>{
    // let sql = "select * from customer where customer_id = 1";
    // let query = db.query(sql,(err,result)=>{
    //     if(err) console.log(err);
    //     else res.render("register");
    // });
    if(typeof req.user != "undefined"){
        req.flash("login","You are already logged in");
        res.render("register",{auth: req.user, flash: res.locals.flash});
        }
    else
        res.render("register");
});

app.get("/cart", (req,res)=>{
    res.render("cart",
    {
        auth: req.user,
        flash: res.locals.flash,
        cart: req.session.cart
    });
});

app.post("/cart/refresh", (req,res)=>{
    let id = req.body.id;
    let qty = parseInt(req.body.qty);
    console.log(qty);
    let subtotal = 0;
    req.session.cart.totals = 0;
    for(let i = 0; i < req.session.cart.items.length; i++) {
        let item =  req.session.cart.items[i];
        subtotal = item.subtotal;
        if(item.item_id == id) {
            subtotal = qty*req.session.cart.items[i].price;
            req.session.cart.items[i].qty = qty;
            req.session.cart.items[i].subtotal = subtotal;
        }
        req.session.cart.totals += subtotal;
    }
    res.redirect("back");
});

app.post("/cart/delete", (req,res)=>{
    let totals = req.session.cart.totals;
    let qty = req.body.qty;
    let id = req.body.id;
    console.log(req.body);
    let price = 0;
    for(let i = 0; i < req.session.cart.items.length; i++) {
        let item =  req.session.cart.items[i];
        if(item.item_id == id) {
            price = qty*req.session.cart.items[i].price;
            req.session.cart.items.splice(i, 1);
        }
    }
    totals -= price;
    req.session.cart.totals = totals;
    res.redirect('back');
});

app.get("/order", (req,res)=>{
    let sql = 0;
    if(!req.session.invalid_id)
        req.session.invalid_id = 0;

    if(req.session.filter == 0){
        sql = "SELECT * FROM item ORDER BY " + req.session.sort_item;

    }
    else{
        sql = "SELECT * FROM item " + "WHERE brand_id = " + req.session.filter + " ORDER BY " + req.session.sort_item;
    }
        db.query(sql, (err,result) =>{
            if(err) console.log(err);
            else{
                var brands;
                    db.query("SELECT * FROM brand", (err,results) => {
                        brands = results;
                        res.render("items",{result: result, 
                                            brand: brands,
                                            auth: req.user,
                                            invalid_id: req.session.invalid_id,
                                            cart_error: res.locals.flash});
                    });
                }   
        }); 

});



app.listen("3000",() => {
    console.log("Listening on port 3000");
});


