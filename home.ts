import { Component, OnInit } from '@angular/core';

import { NavController, App, ModalController, ViewController, LoadingController, ToastController, Platform } from 'ionic-angular';

import { PopoverController, ActionSheetController, AlertController, NavParams } from 'ionic-angular';

import { Http } from '@angular/http';

import { HaversineService, GeoCoord } from 'ng2-haversine';

import * as momentfull from 'moment';

import { Device } from '@ionic-native/device';

import { FCM } from '@ionic-native/fcm';

import { Diagnostic } from '@ionic-native/diagnostic';

import {Observable} from 'rxjs/Rx';

import 'rxjs/add/operator/map';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})

//export class HomePage implements OnInit{
export class HomePage{
  public latitude:any;
  public longitude:any;
  public distancia_geo:any = 0;
  public arrayAnuncios:any = [];
  public arrayTeste:any = [];
  public endereco_formatado_atual;

  public showAtivaGps:boolean = false;

  loading:any;


  //MEU HAVERSINE ESTÁ NA VERSAO "ng2-haversine": "^0.1.1",

  //A LÓGICA É A SEGUINTE: CARREGAR O FIREBASE COM O SNAPSHOT PRA ACESSAR OS DADOS ANTES DE ELES SEREM EXIBIDOS
  //TEM UM ARRAY LOCAL QUE É MONTADO E REMONTADO SEMPRE QUE ALGUMA ALTERAÇÃO ACONTECE
  //PASSO OS SNAPSHOTS NO HAVERSINE PRA COMPARAR COM A DISTANCIA DEFINIDA PELO USUÁRIO
  //SÓ INSIRO NO ARRAY OS QUE PASSAM PELA COMPARAÇÃO E USO OS MESMOS NOMES DAS "COLUNAS DO FIREBASE"
  //ACREDITO QUE VOCÊ TERÁ UMA LÓGICA MAIS BACANA, PORQUE SÓ CONSEGUI FAZER COM O ANGULARFIRE2

  constructor(public navCtrl: NavController, private diagnostic: Diagnostic, public navParams:NavParams, public _app:App, public popoverCtrl: PopoverController, public modalCtrl:ModalController, public viewCtrl:ViewController, public angFire:AngularFire, public loadingCtrl:LoadingController, public actionSheetCtrl:ActionSheetController, private geolocation:Geolocation, private haversineService:HaversineService, public http:Http, public alertCtrl:AlertController, public toastCtrl:ToastController, public platform:Platform, private fcm:FCM, private device:Device) {

    this.loading.present();
    //this.carregaFireBase2();
    this.verificaGPS();
  }

  verificaGPS(){
    this.diagnostic.isLocationEnabled().then((ok)=>{
      console.log("Sera? " + ok);
      if(ok){
        this.showAtivaGps = false;
        this.carregaFireBase();
      }else{
        this.showAtivaGps = true;
        this.erroCarregarFirebase();
        //this.loading.dismiss();
      }
    }).catch((e)=>{
      //alert("ERRO " + e);
      this.loading.dismiss();
      //this.carregando = '0';

      //RETIRAR
      this.carregaFireBase();
    });
  }

  erroCarregarFirebase(){
    console.log("O GPS está desligado!");
  }

  carregaFireBase(){ //FUNCAO QUE VAI CARREGAR OS DADOS LÁ DO FB

    //this.carregando=1;
    this.arrayAnuncios = [];

    this.geolocation.getCurrentPosition().then((resp)=>{

      this.latitude = resp.coords.latitude;
      this.longitude = resp.coords.longitude;

      localStorage.setItem("lat_atual", this.latitude);
      localStorage.setItem("long_atual", this.longitude);

      this.angFire.database.list('/Anunciantes',{
        preserveSnapshot: true
      }).subscribe(snapshots=>{
        snapshots.forEach(snapshot=>{
          let lat_atual = this.latitude;
          let long_atual = this.longitude;

          let lat_anuncio = snapshot.val().LatitudeAnuncio,
          let long_anuncio = snapshot.val().LongitudeAnuncio

          let nomeanuncio = snapshot.val().NomeAnuncio;

          //RESTANTE DOS DADOS QUE VEM DO FIREBASE

          this.tryHaversine(lat_atual, long_atual, lat_anuncio, long_anuncio, nomeanuncio);
        });
      });
    }).catch((err)=>{
        console.log("Erro ao geo");
    });
  }


  tryHaversine(lat_atual, long_atual, lat_anuncio, long_anuncio, nomeanuncio): void {
    //this.status_teste = "Haversine";
      //console.log("Lat atual: " + lat_atual);
      let madrid: GeoCoord = {
          latitude: long_atual,
          longitude: lat_atual
      };

      let bilbao: GeoCoord = {
          latitude: lat_anuncio,
          longitude: long_anuncio
      };

      let kilometers = this.haversineService.getDistanceInKilometers(madrid, bilbao); //FUNCAO DO PROPRIO HAVERSINE, TEM EM OUTROS FORMATOS TBM ESSA DEVOLVE EM KM

      var distancia_geo:any;
      distancia_geo = Number(window.localStorage.getItem("distancia_geo")); //FIZ UM ESQUEMA PRA DEFINIR NO LOCAL O VALOR DO RAIO QUE O USUARIO QUER... TIPO COM PROMPT DO ALERTCONTROLLER MESMO!
      var distancia_cal = Number(kilometers.toFixed(0));


      //limpa o array
      if((distancia_cal<=distancia_geo) || (distancia_geo==0)){
        this.arrayAnuncios.push({ //ESTE É O ARRAY!!! QUE LISTA OS ANUNCIOS QUE PASSAM PELO IF DA DISTANCIA
          LatitudeAnuncio: lat_anuncio,
          LongitudeAnuncio: long_anuncio,
          NomeAnuncio: nomeanuncio,
          //RESTANTE DOS DADOS DO ANUNCIANTE QUE VEM DO FIREBASE
        });
      }
  }

  imprimeLocal(){
    var latitude = this.latitude;
    var longitude = this.longitude;

    console.log("Lat Imp: " + latitude);
    console.log("Long Imp: " + longitude);

    var url = "https://maps.googleapis.com/maps/api/geocode/json?latlng="+latitude+","+longitude+"";

    this.http.get(url)
    .map(res => res.json())
    .subscribe(data => {
      this.endereco_formatado_atual = data.results[0].formatted_address;
    });
  }

  imprimeLocalCep(data){
    console.log("CEP: " + data);

    var url = "https://maps.googleapis.com/maps/api/geocode/json?address=" + data + "";

    this.http.get(url)
    .map(res => res.json())
    .subscribe(data => {
      console.log(data.results[0].formatted_address);
      console.log(data.results[0].geometry.bounds.northeast);

      this.latitude = data.results[0].geometry.bounds.northeast.lat;
      this.longitude = data.results[0].geometry.bounds.northeast.lng;

      this.endereco_formatado_atual = data.results[0].formatted_address;

      this.recarregaFireBase();
    });
  }

  define_distancia_geo(){
    let prompt = this.alertCtrl.create({
      title: 'Defina a distância dos resultados',
      message: 'Defina o valor da distância',

      inputs: [
        {
          name: 'distresultados',
          placeholder: 'Digite a distância',
          type: 'number'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          handler: data =>{
            console.log('clicou cancelar');
          }
        },
        {
          text: 'Salvar',
          handler: data =>{
            window.localStorage.removeItem("distancia_geo");
            window.localStorage.setItem("distancia_geo", data.distresultados);
            console.log("Distancia: " + data.distresultados);
            //mostra msg distancia
            this.arrayAnuncios = []; //LIMPA O ARRAY PRA REMONTÁ-LO
            this.carregaFireBase();
            //this.msgSucessoDistancia();
          }
        }
      ]

    });

    prompt.present();
  }

  troque_local_geo(){
    console.log("Trocar lcal");
    let prompt = this.alertCtrl.create({
      title: 'Qual endereço?',
      message: 'Digite o CEP ou o endereço',

      inputs: [
        {
          name: 'buscacep',
          placeholder: 'CEP ou Endereço'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          handler: data =>{
            console.log('clicou cancelar');
          }
        },
        {
          text: 'Procurar',
          handler: data =>{
            this.imprimeLocalCep(data.buscacep);
            console.log(data.buscacep);
          }
        }
      ]

    });

    prompt.present();
  }

}


